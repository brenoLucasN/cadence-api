import { app } from "../src/index.js";

export default {
  fetch(request: Request) {
    return app.handle(request);
  },
};
