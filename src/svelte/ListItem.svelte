<script lang="ts" generics="T">
  import { onDestroy } from "svelte";
  import { isRTLDocument, type ItemResizeObserver } from "../core";
  import { styleToString } from "./utils";
  import type { SvelteHTMLElements } from "svelte/elements";

  export let children: (item: T, index: number) => any;
  export let item: T;
  export let as: keyof SvelteHTMLElements | undefined = "div";
  export let index: number;
  export let offset: number;
  export let hide: boolean;
  export let horizontal: boolean;
  export let resizer: ItemResizeObserver;

  let elementRef: HTMLDivElement;
  let cleanupResizer: (() => void) | undefined;
  let prevIndex: number | undefined;

  $: {
    if (prevIndex !== index) {
      if (cleanupResizer) cleanupResizer();
      cleanupResizer = resizer(elementRef, (prevIndex = index));
    }
  }

  onDestroy(() => {
    if (cleanupResizer) cleanupResizer();
  });

  $: style = styleToString({
    position: "absolute",
    [horizontal ? "height" : "width"]: "100%",
    [horizontal ? "top" : "left"]: "0px",
    [horizontal ? (isRTLDocument() ? "right" : "left") : "top"]: offset + "px",
    visibility: hide ? "hidden" : "visible",
    ...(horizontal && { display: "flex" })
  });
</script>

<svelte:element this={as} bind:this={elementRef} {style}>
  {#if children}
    {children(item, index)}
  {/if}
</svelte:element>