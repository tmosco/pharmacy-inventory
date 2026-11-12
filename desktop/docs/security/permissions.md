# Permission inventory
Feature: local product catalog
Window: main
Permission: sql:default
Why: load pharmacy.db and query catalog records
Where used: src/data/db.ts and productRepository.ts
Scope/limits: native command access; not staff authorization
Review: keep for current feature

Permission: sql:allow-execute
Why: create/update/deactivate products through the repository
Risk: generic SQL execution from the permitted webview
Mitigation: trusted local content, constraints, parameter binding
Production follow-up: native authorization and narrow commands