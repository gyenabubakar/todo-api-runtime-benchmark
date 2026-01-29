package handlers

import (
	"errors"
	"net/http"
	"time"

	"todos-api/internal/cache"
	"todos-api/internal/middleware"
	"todos-api/internal/models"
	"todos-api/internal/repository"

	"github.com/google/uuid"

	"github.com/gin-gonic/gin"
)

const cacheTTL = 5 * time.Minute

type TodoHandler struct {
	todoRepo *repository.TodoRepository
	cache    cache.CacheService
	baseURL  string
}

func NewTodoHandler(todoRepo *repository.TodoRepository, cache cache.CacheService, baseURL string) *TodoHandler {
	return &TodoHandler{
		todoRepo: todoRepo,
		cache:    cache,
		baseURL:  baseURL,
	}
}

func (h *TodoHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// Try cache first
	cacheKey := cache.TodosKey(userID)
	var cached []models.TodoResponse
	if err := h.cache.Get(c.Request.Context(), cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, cached)
		return
	}

	// Fetch from database
	todos, err := h.todoRepo.FindAll(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todos"})
		return
	}

	// Convert to response
	response := make([]models.TodoResponse, len(todos))
	for i, todo := range todos {
		response[i] = todo.ToResponse(h.baseURL)
	}

	// Cache result
	_ = h.cache.Set(c.Request.Context(), cacheKey, response, cacheTTL)

	c.JSON(http.StatusOK, response)
}

func (h *TodoHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.CreateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	todo := &models.Todo{
		UserID:    userID,
		Title:     req.Title,
		Order:     req.Order,
		Completed: false,
	}

	if err := h.todoRepo.Create(c.Request.Context(), todo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create todo"})
		return
	}

	// Invalidate cache
	_ = h.cache.Delete(c.Request.Context(), cache.TodosKey(userID))

	c.JSON(http.StatusCreated, todo.ToResponse(h.baseURL))
}

func (h *TodoHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	// Try cache first
	cacheKey := cache.TodoKey(id)
	var cached models.TodoResponse
	if err := h.cache.Get(c.Request.Context(), cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, cached)
		return
	}

	todo, err := h.todoRepo.FindByID(c.Request.Context(), id, userID)
	if errors.Is(err, repository.ErrTodoNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todo"})
		return
	}

	response := todo.ToResponse(h.baseURL)

	// Cache result
	_ = h.cache.Set(c.Request.Context(), cacheKey, response, cacheTTL)

	c.JSON(http.StatusOK, response)
}

func (h *TodoHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var req models.UpdateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	todo, err := h.todoRepo.UpdateFields(c.Request.Context(), id, userID, &req)
	if errors.Is(err, repository.ErrTodoNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}

	// Invalidate caches
	_ = h.cache.Delete(c.Request.Context(), cache.TodosKey(userID))
	_ = h.cache.Delete(c.Request.Context(), cache.TodoKey(id))

	c.JSON(http.StatusOK, todo.ToResponse(h.baseURL))
}

func (h *TodoHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	if err := h.todoRepo.Delete(c.Request.Context(), id, userID); err != nil {
		if errors.Is(err, repository.ErrTodoNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete todo"})
		return
	}

	// Invalidate caches
	_ = h.cache.Delete(c.Request.Context(), cache.TodosKey(userID))
	_ = h.cache.Delete(c.Request.Context(), cache.TodoKey(id))

	c.Status(http.StatusNoContent)
}

func (h *TodoHandler) DeleteAll(c *gin.Context) {
	userID := middleware.GetUserID(c)

	if _, err := h.todoRepo.DeleteAll(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete todos"})
		return
	}

	// Invalidate cache
	_ = h.cache.Delete(c.Request.Context(), cache.TodosKey(userID))

	c.Status(http.StatusNoContent)
}
