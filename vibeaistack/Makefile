SUDO=sudo
COMPOSE=$(SUDO) docker compose
PROJECT=vibe-wiki-ai

# ─────────────────────────────
# BUILD
# ─────────────────────────────
build:
	$(COMPOSE) -p $(PROJECT) build

# ─────────────────────────────
# START
# ─────────────────────────────
up:
	$(COMPOSE) -p $(PROJECT) up -d

# ─────────────────────────────
# STOP
# ─────────────────────────────
down:
	$(COMPOSE) -p $(PROJECT) down

# ─────────────────────────────
# REBUILD EVERYTHING
# ─────────────────────────────
re: down build up
	@echo "🔄 full rebuild complete"

# ─────────────────────────────
# LOGS
# ─────────────────────────────
logs:
	$(COMPOSE) -p $(PROJECT) logs -f

# ─────────────────────────────
# SERVICE REBUILD
# ─────────────────────────────
rebuild-frontend:
	$(COMPOSE) -p $(PROJECT) build frontend
	$(COMPOSE) -p $(PROJECT) up -d frontend

rebuild-backend:
	$(COMPOSE) -p $(PROJECT) build backend
	$(COMPOSE) -p $(PROJECT) up -d backend

# ─────────────────────────────
# SHELL ACCESS
# ─────────────────────────────
shell-frontend:
	$(COMPOSE) -p $(PROJECT) exec frontend sh

shell-backend:
	$(COMPOSE) -p $(PROJECT) exec backend sh

# ─────────────────────────────
# CLEAN RESET
# ─────────────────────────────
clean:
	$(COMPOSE) -p $(PROJECT) down --volumes --remove-orphans
	$(SUDO) docker system prune -f

# ─────────────────────────────
# STATUS
# ─────────────────────────────
ps:
	$(COMPOSE) -p $(PROJECT) ps