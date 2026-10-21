/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useJavascriptIndex, useJavascriptPackage } from "./use-javascript-data";
import type { JavascriptIndex, JavascriptPackage } from "@/types/javascript";

vi.mock("@/lib/api/javascript-data", () => ({
  loadIndex: vi.fn(),
  loadPackage: vi.fn(),
}));

import * as javascriptData from "@/lib/api/javascript-data";

const loadIndex = javascriptData.loadIndex as ReturnType<typeof vi.fn>;
const loadPackage = javascriptData.loadPackage as ReturnType<typeof vi.fn>;

const index: JavascriptIndex = { ecosystem: "javascript", packages: [] };
const express: JavascriptPackage = { name: "instrumentation-express" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useJavascriptIndex", () => {
  it("starts loading, then returns the index", async () => {
    loadIndex.mockResolvedValue(index);

    const { result } = renderHook(() => useJavascriptIndex());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(index);
    expect(result.current.error).toBeNull();
  });

  it("reports a load failure as an error", async () => {
    loadIndex.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useJavascriptIndex());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe("network down");
  });
});

describe("useJavascriptPackage", () => {
  it("starts loading so callers don't render an empty state first", () => {
    loadPackage.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useJavascriptPackage("instrumentation-express"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("loads the requested release", async () => {
    loadPackage.mockResolvedValue(express);

    const { result } = renderHook(() => useJavascriptPackage("instrumentation-express", "0.70.0"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(express);
    expect(loadPackage).toHaveBeenCalledWith("instrumentation-express", "0.70.0");
  });

  it("settles without fetching when there is no name", async () => {
    const { result } = renderHook(() => useJavascriptPackage(""));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(loadPackage).not.toHaveBeenCalled();
  });

  it("reports a missing package as an error", async () => {
    loadPackage.mockRejectedValue(new Error('JavaScript package "x" not found'));

    const { result } = renderHook(() => useJavascriptPackage("x"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toContain("not found");
  });

  it("reloads when the version changes", async () => {
    loadPackage.mockResolvedValue(express);

    const { result, rerender } = renderHook(
      ({ version }) => useJavascriptPackage("instrumentation-express", version),
      { initialProps: { version: "0.70.0" } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ version: "0.69.0" });

    await waitFor(() =>
      expect(loadPackage).toHaveBeenLastCalledWith("instrumentation-express", "0.69.0")
    );
  });

  it("ignores a result that arrives after the version changed", async () => {
    let resolveOld!: (p: JavascriptPackage) => void;
    loadPackage
      .mockReturnValueOnce(new Promise<JavascriptPackage>((r) => (resolveOld = r)))
      .mockResolvedValueOnce({ name: "instrumentation-express", node_engine: "new" });

    const { result, rerender } = renderHook(
      ({ version }) => useJavascriptPackage("instrumentation-express", version),
      { initialProps: { version: "0.69.0" } }
    );
    rerender({ version: "0.70.0" });
    await waitFor(() => expect(result.current.data?.node_engine).toBe("new"));

    // act() flushes the update a late resolve would trigger, so the check below
    // sees it if the hook fails to drop it.
    await act(async () => {
      resolveOld({ name: "instrumentation-express", node_engine: "old" });
    });

    expect(result.current.data?.node_engine).toBe("new");
  });
});
