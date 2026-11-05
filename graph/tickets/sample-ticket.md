# Add a health-check endpoint

Id: SAMPLE-1
Component: graph-sample-repo
Labels: backend, small

We need a `/healthz` endpoint that returns 200 with `{"status":"ok"}` so the deploy pipeline
can probe liveness. No auth required. Should be covered by one unit test.
