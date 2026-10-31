import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

window.scrollTo = () => {};

afterEach(() => cleanup());
