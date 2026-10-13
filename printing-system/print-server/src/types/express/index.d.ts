// Augments Express's Request type so `req.requestId` (a per-request
// correlation id, mirrored in the `x-request-id` response header) is
// recognized everywhere without needing a cast. The Request interface
// actually lives in `express-serve-static-core`; `express` just
// re-exports it, so augmenting `express` directly does not merge.
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
  }
}
