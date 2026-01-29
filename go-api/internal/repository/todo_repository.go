package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"todos-api/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrTodoNotFound = errors.New("todo not found")

type TodoRepository struct {
	db *pgxpool.Pool
}

func NewTodoRepository(db *pgxpool.Pool) *TodoRepository {
	return &TodoRepository{db: db}
}

func (r *TodoRepository) Create(ctx context.Context, todo *models.Todo) error {
	todo.ID = uuid.New()
	todo.CreatedAt = time.Now()
	todo.UpdatedAt = time.Now()

	_, err := r.db.Exec(ctx,
		`INSERT INTO todos (id, user_id, title, "order", completed, url, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		todo.ID, todo.UserID, todo.Title, todo.Order, todo.Completed, todo.URL, todo.CreatedAt, todo.UpdatedAt,
	)
	return err
}

func (r *TodoRepository) FindAll(ctx context.Context, userID uuid.UUID) ([]models.Todo, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, title, "order", completed, url, created_at, updated_at
		 FROM todos WHERE user_id = $1
		 ORDER BY "order" NULLS LAST, created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	todos := make([]models.Todo, 0, 16)
	for rows.Next() {
		var todo models.Todo
		err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Order, &todo.Completed, &todo.URL, &todo.CreatedAt, &todo.UpdatedAt)
		if err != nil {
			return nil, err
		}
		todos = append(todos, todo)
	}

	return todos, rows.Err()
}

func (r *TodoRepository) FindByID(ctx context.Context, id, userID uuid.UUID) (*models.Todo, error) {
	todo := &models.Todo{}
	err := r.db.QueryRow(ctx,
		`SELECT id, user_id, title, "order", completed, url, created_at, updated_at
		 FROM todos WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Order, &todo.Completed, &todo.URL, &todo.CreatedAt, &todo.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTodoNotFound
	}
	if err != nil {
		return nil, err
	}
	return todo, nil
}

func (r *TodoRepository) Update(ctx context.Context, todo *models.Todo) error {
	todo.UpdatedAt = time.Now()

	result, err := r.db.Exec(ctx,
		`UPDATE todos SET title = $1, "order" = $2, completed = $3, url = $4, updated_at = $5
		 WHERE id = $6 AND user_id = $7`,
		todo.Title, todo.Order, todo.Completed, todo.URL, todo.UpdatedAt, todo.ID, todo.UserID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrTodoNotFound
	}
	return nil
}

func (r *TodoRepository) UpdateFields(ctx context.Context, id, userID uuid.UUID, req *models.UpdateTodoRequest) (*models.Todo, error) {
	setClauses := []string{`updated_at = $1`}
	args := []interface{}{time.Now()}
	argIndex := 2

	if req.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf(`title = $%d`, argIndex))
		args = append(args, *req.Title)
		argIndex++
	}
	if req.Order != nil {
		setClauses = append(setClauses, fmt.Sprintf(`"order" = $%d`, argIndex))
		args = append(args, *req.Order)
		argIndex++
	}
	if req.Completed != nil {
		setClauses = append(setClauses, fmt.Sprintf(`completed = $%d`, argIndex))
		args = append(args, *req.Completed)
		argIndex++
	}

	args = append(args, id, userID)
	query := fmt.Sprintf(
		`UPDATE todos SET %s WHERE id = $%d AND user_id = $%d
		 RETURNING id, user_id, title, "order", completed, url, created_at, updated_at`,
		strings.Join(setClauses, ", "), argIndex, argIndex+1,
	)

	todo := &models.Todo{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&todo.ID, &todo.UserID, &todo.Title, &todo.Order, &todo.Completed,
		&todo.URL, &todo.CreatedAt, &todo.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTodoNotFound
	}
	if err != nil {
		return nil, err
	}
	return todo, nil
}

func (r *TodoRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	result, err := r.db.Exec(ctx,
		`DELETE FROM todos WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrTodoNotFound
	}
	return nil
}

func (r *TodoRepository) DeleteAll(ctx context.Context, userID uuid.UUID) (int64, error) {
	result, err := r.db.Exec(ctx,
		`DELETE FROM todos WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
