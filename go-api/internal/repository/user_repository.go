package repository

import (
	"context"
	"errors"
	"time"

	"todos-api/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUserNotFound = errors.New("user not found")

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	_, err := r.db.Exec(ctx,
		`INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		user.ID, user.Email, user.PasswordHash, user.Name, user.CreatedAt, user.UpdatedAt,
	)
	return err
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	user := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, email, password_hash, name, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.CreatedAt, &user.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	user := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, email, password_hash, name, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.CreatedAt, &user.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}
