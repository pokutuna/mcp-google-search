PROJECT ?= YOUR_PROJECT_ID
GCLOUD := gcloud --project=$(PROJECT)

.PHONY: build
build:
	npm install
	npm run build

.PHONY: deploy
deploy: build
	$(GCLOUD) app deploy
