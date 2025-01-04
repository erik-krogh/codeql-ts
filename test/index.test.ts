import { expect } from "chai";

import * as index from "../src/index.js";

describe("foo", function () {
  it("should return foo", function () {
    expect(index.foo()).to.equal("foo");
  });
});
