package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/valkey-io/valkey-go"
)

type CacheService interface {
	Get(ctx context.Context, key string, dest interface{}) error
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

type ValkeyCache struct {
	client valkey.Client
}

func NewValkeyCache(client valkey.Client) *ValkeyCache {
	return &ValkeyCache{client: client}
}

func (c *ValkeyCache) Get(ctx context.Context, key string, dest interface{}) error {
	cmd := c.client.B().Get().Key(key).Build()
	data, err := c.client.Do(ctx, cmd).AsBytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

func (c *ValkeyCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	cmd := c.client.B().Set().Key(key).Value(string(data)).Ex(ttl).Build()
	return c.client.Do(ctx, cmd).Error()
}

func (c *ValkeyCache) Delete(ctx context.Context, key string) error {
	cmd := c.client.B().Del().Key(key).Build()
	return c.client.Do(ctx, cmd).Error()
}

func (c *ValkeyCache) DeletePattern(ctx context.Context, pattern string) error {
	var cursor uint64
	for {
		cmd := c.client.B().Scan().Cursor(cursor).Match(pattern).Build()
		resp, err := c.client.Do(ctx, cmd).AsScanEntry()
		if err != nil {
			return err
		}
		for _, key := range resp.Elements {
			delCmd := c.client.B().Del().Key(key).Build()
			if err := c.client.Do(ctx, delCmd).Error(); err != nil {
				return err
			}
		}
		cursor = resp.Cursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

func TodosKey(userID uuid.UUID) string {
	return fmt.Sprintf("todos:user:%s", userID.String())
}

func TodoKey(id uuid.UUID) string {
	return fmt.Sprintf("todo:%s", id.String())
}
