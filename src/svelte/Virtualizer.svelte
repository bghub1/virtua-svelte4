<script lang="ts" generics="T">
  import { onMount, onDestroy } from "svelte";
  import {
    ACTION_ITEMS_LENGTH_CHANGE,
    ACTION_START_OFFSET_CHANGE,
    type StateVersion,
    UPDATE_SCROLL_END_EVENT,
    UPDATE_SCROLL_EVENT,
    UPDATE_VIRTUAL_STATE,
    createResizer,
    createScroller,
    createVirtualStore,
    getScrollSize as _getScrollSize,
  } from "../core";
  import { defaultGetKey, styleToString, iterRange } from "./utils";
  import ListItem from "./ListItem.svelte";
  import type { VirtualizerHandle, VirtualizerProps } from "./Virtualizer.type";

  interface Props extends VirtualizerProps<T> {}

  export let data: T[];
  export let getKey = defaultGetKey;
  export let as = "div";
  export let itemAs;
  export let scrollRef;
  export let overscan;
  export let itemSize;
  export let shift = false;
  export let horizontal = false;
  export let startMargin = 0;
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
  const resizer = createResizer(store, horizontal);
  const scroller = createScroller(store, horizontal);
  const unsubscribeStore = store.$subscribe(UPDATE_VIRTUAL_STATE, () => {
    rerender = store.$getStateVersion();
  });
  const unsubscribeOnScroll = store.$subscribe(UPDATE_SCROLL_EVENT, () => {
    onscroll && onscroll(store.$getScrollOffset());
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
    const assignRef = (scrollable: HTMLElement) => {
      resizer.$observeRoot(scrollable);
      scroller.$observe(scrollable);
    };
    if (scrollRef) {
      assignRef(scrollRef);
    } else {
      assignRef(containerRef!.parentElement!);
    }
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

  $: if (startMargin !== store.$getStartSpacerSize()) {
    store.$update(ACTION_START_OFFSET_CHANGE, startMargin);
  }

  let prevJumpCount: number | undefined;
  $: {
    if (prevJumpCount !== jumpCount) {
      prevJumpCount = jumpCount;
      scroller.$fixScrollJump();
    }
  }

  export const getScrollOffset = store.$getScrollOffset;
  export const getScrollSize = () => _getScrollSize(store);
  export const getViewportSize = store.$getViewportSize;
  export const findStartIndex = store.$findStartIndex;
  export const findEndIndex = store.$findEndIndex;
  export const getItemOffset = store.$getItemOffset;
  export const getItemSize = store.$getItemSize;
  export const scrollToIndex = scroller.$scrollToIndex;
  export const scrollTo = scroller.$scrollTo;
  export const scrollBy = scroller.$scrollBy;

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

<svelte:element this={as} bind:this={containerRef} style={containerStyle}>
  {#each iterRange(range) as index (getKey(data[index]!, index))}
    {@const item = data[index]!}
    <ListItem
      {children}
      {item}
      {index}
      as={itemAs}
      offset={store.$getItemOffset(index)}
      hide={store.$isUnmeasuredItem(index)}
      {horizontal}
      resizer={resizer.$observeItem}
    />
  {/each}
</svelte:element>