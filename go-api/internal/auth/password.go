package auth

import (
	"runtime"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	// Using worker pool - see benchmarks at 2000 VUs
	return HashPasswordWithWorkerPool(password)

	// Original implementation (no worker pool):
	// bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	// return string(bytes), err
}

func VerifyPassword(password, hash string) bool {
	// Using worker pool - see benchmarks at 2000 VUs
	return VerifyPasswordWithWorkerPool(password, hash)

	// Original implementation (no worker pool):
	// err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	// return err == nil
}

// Worker Pool Implementation (Benchmarked - Did Not Improve Performance)
//
// A worker pool was tested to limit concurrent bcrypt operations, similar to
// Swift's NIOThreadPool approach. The hypothesis was that limiting concurrency
// would reduce CPU contention and prevent request timeouts under high load.
//
// Results: No improvement. With 1000 VUs, the worker pool version had slightly
// worse performance (281 failed requests vs 273, 9,971 iterations vs 10,159).
//
// Why it didn't help:
// - Go's goroutines are lightweight green threads, not OS threads
// - The worker pool only limits how many goroutines run bcrypt simultaneously
// - Goroutines still share the Go scheduler and compete for CPU time
// - The bottleneck is the bcrypt library performance itself, not concurrency
//
// Swift's NIOThreadPool works differently - it uses actual POSIX threads that
// run outside the async runtime, with OS-level scheduling optimizations.
//
// See BENCHMARK-RESULTS_1000.md for full comparison.

var bcryptWorkerPool chan struct{}

func init() {
	bcryptWorkerPool = make(chan struct{}, runtime.NumCPU()*2)
}

func HashPasswordWithWorkerPool(password string) (string, error) {
	bcryptWorkerPool <- struct{}{}        // acquire semaphore
	defer func() { <-bcryptWorkerPool }() // release semaphore

	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func VerifyPasswordWithWorkerPool(password, hash string) bool {
	bcryptWorkerPool <- struct{}{}        // acquire semaphore
	defer func() { <-bcryptWorkerPool }() // release semaphore

	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
