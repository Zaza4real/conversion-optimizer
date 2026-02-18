# Web Pixel Extension

Subscribes to: page_view, product_view, add_to_cart, begin_checkout, purchase.
Sends to our ingestion endpoint with anon_id, session_id, experiment_id/variant when in experiment.
Deterministic bucketing (hash anon_id + experiment_id); assignment persisted in cookie/localStorage.
