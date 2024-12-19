<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    ACTION_ITEMS_LENGTH_CHANGE,
    type StateVersion,
    UPDATE_SCROLL_END_EVENT,
    UPDATE_SCROLL_EVENT,
    UPDATE_VIRTUAL_STATE,
    createVirtualStore,
    getScrollSize as _getScrollSize,
    createWindowResizer,
    createWindowScroller,
  } from "../core";
  import { defaultGetKey, iterRange, styleToString } from "./utils";
  import ListItem from "./ListItem.svelte";
  import type {
    WindowVirtualizerHandle,
    WindowVirtualizerProps,
  } from "./WindowVirtualizer.type";

  interface Props extends WindowVirtualizerProps<T> {}

  export let data: T[];
  export let getKey = defaultGetKey;
  export let overscan;
  export let itemSize;
  export let shift = false;
  export let horizontal = false;
  export let children;
  export let onscroll;
  export let onscrollend;

  const store = createVirtualStore(
    data.length,
    itemSize,
    overscan,
    undefined,
    undefined,
    !itemSize
  );
  const resizer = createWindowResizer(store, horizontal);
  const scroller = createWindowScroller(store, horizontal);
  const unsubscribeStore = store.$subscribe(UPDATE_VIRTUAL_STATE, () => {
    rerender = store.$getStateVersion();
  });

  const unsubscribeOnScroll = store.$subscribe(UPDATE_SCROLL_EVENT, () => {
    onscroll && onscroll();
  });
  const unsubscribeOnScrollEnd = store.$subscribe(
    UPDATE_SCROLL_END_EVENT,
    () => {
      onscrollend && onscrollend();
    }
  );

  let containerRef: HTMLDivElement | undefined;

  let rerender: StateVersion = store.$getStateVersion();

  let range = store.$getRange();
  let isScrolling = store.$isScrolling();
  let totalSize = store.$getTotalSize();
  let jumpCount = store.$getJumpCount();

  onMount(() => {
    resizer.$observeRoot(containerRef!);
    scroller.$observe(containerRef!);
  });
  onDestroy(() => {
    unsubscribeStore();
    unsubscribeOnScroll();
    unsubscribeOnScrollEnd();
    resizer.$dispose();
    scroller.$dispose();
  });

  $: if (data.length !== store.$getItemsLength()) {
    store.$update(ACTION_ITEMS_LENGTH_CHANGE, [data.length, shift]);
  }

  let prevJumpCount: number | undefined;
  $: {
    if (prevJumpCount !== jumpCount) {
      prevJumpCount = jumpCount;
      scroller.$fixScrollJump();
    }
  }

  export const findStartIndex = store.$findStartIndex;
  export const findEndIndex = store.$findEndIndex;
  export const scrollToIndex = scroller.$scrollToIndex;

  let containerStyle = styleToString({
    "overflow-anchor": "none",
    flex: "none",
    position: "relative",
    visibility: "hidden",
    width: horizontal ? totalSize + "px" : "100%",
    height: horizontal ? "100%" : totalSize + "px",
    "pointer-events": isScrolling ? "none" : undefined,
  });
</script>

<!-- 
  @component
  {@link Virtualizer} controlled by the window scrolling. See {@link WindowVirtualizerProps} and {@link WindowVirtualizerHandle}.
-->
<div bind:this={containerRef} style={containerStyle}>
  {#each iterRange(range) as index (getKey(data[index]!, index))}
    {@const item = data[index]!}
    <ListItem
      {children}
      {item}
      {index}
      as="div"
      offset={store.$getItemOffset(index)}
      hide={store.$isUnmeasuredItem(index)}
      {horizontal}
      resizer={resizer.$observeItem}
    />
  {/each}
</div>