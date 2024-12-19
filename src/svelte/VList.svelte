<script lang="ts" generics="T">
  import { styleToString } from "./utils";
  import Virtualizer from "./Virtualizer.svelte";
  import type { VListProps, VListHandle } from "./VList.type";
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends VListProps<T> {}
  type RestProps = Omit<Props, keyof VListProps<T>> & HTMLAttributes<HTMLDivElement>;

  export let data: Props['data'];
  export let getKey: Props['getKey'];
  export let overscan: Props['overscan'];
  export let itemSize: Props['itemSize'];
  export let shift: Props['shift'];
  export let horizontal: Props['horizontal'];
  export let children: Props['children'];
  export let onscroll: Props['onscroll'];
  export let onscrollend: Props['onscrollend'];
  export let rest: RestProps;

  let ref: Virtualizer<T>;

  export function getScrollOffset() {
    return ref.getScrollOffset();
  }

  export function getScrollSize() {
    return ref.getScrollSize();
  }

  export function getViewportSize() {
    return ref.getViewportSize();
  }

  export function findStartIndex() {
    return ref.findStartIndex();
  }

  export function findEndIndex() {
    return ref.findEndIndex();
  }

  export function getItemOffset(index: number) {
    return ref.getItemOffset(index);
  }

  export function getItemSize(index: number) {
    return ref.getItemSize(index);
  }

  export function scrollToIndex(index: number, options?: ScrollToOptions) {
    return ref.scrollToIndex(index, options);
  }

  export function scrollTo(offset: number, options?: ScrollToOptions) {
    return ref.scrollTo(offset, options);
  }

  export function scrollBy(delta: number, options?: ScrollToOptions) {
    return ref.scrollBy(delta, options);
  }

  const viewportStyle = styleToString({
    display: horizontal ? "inline-block" : "block",
    [horizontal ? "overflow-x" : "overflow-y"]: "auto",
    contain: "strict",
    width: "100%",
    height: "100%",
  });
</script>

<!-- 
  @component
  Virtualized list component. See {@link VListProps} and {@link VListHandle}.
-->
<div {...rest} style={`${viewportStyle} ${rest.style || ''}`}>
  <Virtualizer
    bind:this={ref}
    {data}
    {children}
    {getKey}
    {overscan}
    {itemSize}
    {shift}
    {horizontal}
    {onscroll}
    {onscrollend}
  />
</div>