SHELL := /bin/bash

.PHONY: prepare bun go swift bench-500 bench-1k bench-2k bench-4k result compare

prepare:
	@bun _scripts/prepare.ts

bun:
	@bun _scripts/start-backend.ts bun

go:
	@bun _scripts/start-backend.ts go

swift:
	@bun _scripts/start-backend.ts swift

bench-500:
	@bun _scripts/bench.ts 500

bench-1k:
	@bun _scripts/bench.ts 1000

bench-2k:
	@bun _scripts/bench.ts 2000

bench-4k:
	@bun _scripts/bench.ts 4000

result:
	@bun _scripts/result.ts

compare:
	@bun _scripts/compare.ts
