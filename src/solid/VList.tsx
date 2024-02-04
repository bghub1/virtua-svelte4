/**
 * @jsxImportSource solid-js
 */
import {
  onMount,
  onCleanup,
  createEffect,
  createSignal,
  createMemo,
  JSX,
  on,
  createComputed,
} from "solid-js";
import {
  SCROLL_IDLE,
  UPDATE_SCROLL_STATE,
  UPDATE_SCROLL_EVENT,
  UPDATE_SCROLL_END_EVENT,
  UPDATE_SIZE_STATE,
  overscanStartIndex,
  overscanEndIndex,
  createVirtualStore,
  ACTION_ITEMS_LENGTH_CHANGE,
  getScrollSize,
  getMinContainerSize,
  ItemsRange,
} from "../core/store";
import { createResizer } from "../core/resizer";
import { createScroller } from "../core/scroller";
import { ScrollToIndexOpts } from "../core/types";
import { ViewportComponentAttributes } from "./types";
import { ListItem } from "./ListItem";
import { RangedFor } from "./RangedFor";
import { exists } from "../core/utils";

/**
 * Methods of {@link VList}.
 */
export interface VListHandle {
  /**
   * Get current scrollTop or scrollLeft.
   */
  readonly scrollOffset: number;
  /**
   * Get current scrollHeight or scrollWidth.
   */
  readonly scrollSize: number;
  /**
   * Get current offsetHeight or offsetWidth.
   */
  readonly viewportSize: number;
  /**
   * Scroll to the item specified by index.
   * @param index index of item
   * @param opts options
   */
  scrollToIndex(index: number, opts?: ScrollToIndexOpts): void;
  /**
   * Scroll to the given offset.
   * @param offset offset from start
   */
  scrollTo(offset: number): void;
  /**
   * Scroll by the given offset.
   * @param offset offset from current position
   */
  scrollBy(offset: number): void;
}

/**
 * Props of {@link VList}.
 */
export interface VListProps<T> extends ViewportComponentAttributes {
  /**
   * Get reference to {@link VListHandle}.
   */
  ref?: (handle?: VListHandle) => void;
  /**
   * The data items rendered by this component.
   */
  data: T[];
  /**
   * The elements renderer function.
   */
  children: (data: T, index: number) => JSX.Element;
  /**
   * Number of items to render above/below the visible bounds of the list. Lower value will give better performance but you can increase to avoid showing blank items in fast scrolling.
   * @defaultValue 4
   */
  overscan?: number;
  /**
   * Item size hint for unmeasured items. It will help to reduce scroll jump when items are measured if used properly.
   *
   * - If not set, initial item sizes will be automatically estimated from measured sizes. This is recommended for most cases.
   * - If set, you can opt out estimation and use the value as initial item size.
   */
  itemSize?: number;
  /**
   * While true is set, scroll position will be maintained from the end not usual start when items are added to/removed from start. It's recommended to set false if you add to/remove from mid/end of the list because it can cause unexpected behavior. This prop is useful for reverse infinite scrolling.
   */
  shift?: boolean;
  /**
   * If true, rendered as a horizontally scrollable list. Otherwise rendered as a vertically scrollable list.
   */
  horizontal?: boolean;
  /**
   * Callback invoked whenever scroll offset changes.
   * @param offset Current scrollTop or scrollLeft.
   */
  onScroll?: (offset: number) => void;
  /**
   * Callback invoked when scrolling stops.
   */
  onScrollEnd?: () => void;
  /**
   * Callback invoked when visible items range changes.
   */
  onRangeChange?: (
    /**
     * The start index of viewable items.
     */
    startIndex: number,
    /**
     * The end index of viewable items.
     */
    endIndex: number
  ) => void;
}

/**
 * Virtualized list component. See {@link VListProps} and {@link VListHandle}.
 */
export const VList = <T,>(props: VListProps<T>): JSX.Element => {
  let rootRef: HTMLDivElement | undefined;

  const {
    ref: _ref,
    data: _data,
    children: _children,
    overscan: _overscan,
    itemSize,
    shift: _shift,
    horizontal = false,
    onScroll: _onScroll,
    onScrollEnd: _onScrollEnd,
    onRangeChange: _onRangeChange,
    style: _style,
    ...attrs
  } = props;

  const store = createVirtualStore(
    props.data.length,
    itemSize ?? 40,
    undefined,
    undefined,
    !itemSize
  );
  const resizer = createResizer(store, horizontal);
  const scroller = createScroller(store, horizontal);

  const [rerender, setRerender] = createSignal(store._getStateVersion());

  const unsubscribeStore = store._subscribe(
    UPDATE_SCROLL_STATE + UPDATE_SIZE_STATE,
    () => {
      setRerender(store._getStateVersion());
    }
  );

  const unsubscribeOnScroll = store._subscribe(UPDATE_SCROLL_EVENT, () => {
    props.onScroll?.(store._getScrollOffset());
  });
  const unsubscribeOnScrollEnd = store._subscribe(
    UPDATE_SCROLL_END_EVENT,
    () => {
      props.onScrollEnd?.();
    }
  );

  const isSameRange = (prev: ItemsRange, next: ItemsRange): boolean => {
    return prev[0] === next[0] && prev[1] === next[1];
  };

  const range = createMemo<ItemsRange>((prev) => {
    rerender();
    const next = store._getRange();
    if (prev && isSameRange(prev, next)) {
      return prev;
    }
    return next;
  });
  const scrollDirection = createMemo(
    () => rerender() && store._getScrollDirection()
  );
  const totalSize = createMemo(() => rerender() && store._getTotalSize());
  // https://github.com/inokawa/virtua/issues/252#issuecomment-1822861368
  const minSize = createMemo(() => rerender() && getMinContainerSize(store));

  const jumpCount = createMemo(() => rerender() && store._getJumpCount());

  const overscanedRange = createMemo<ItemsRange>((prev) => {
    const overscan = props.overscan ?? 4;
    const [startIndex, endIndex] = range();
    const next: ItemsRange = [
      overscanStartIndex(startIndex, overscan, scrollDirection()),
      overscanEndIndex(
        endIndex,
        overscan,
        scrollDirection(),
        props.data.length
      ),
    ];
    if (prev && isSameRange(prev, next)) {
      return prev;
    }
    return next;
  });

  onMount(() => {
    if (props.ref) {
      props.ref({
        get scrollOffset() {
          return store._getScrollOffset();
        },
        get scrollSize() {
          return getScrollSize(store);
        },
        get viewportSize() {
          return store._getViewportSize();
        },
        scrollToIndex: scroller._scrollToIndex,
        scrollTo: scroller._scrollTo,
        scrollBy: scroller._scrollBy,
      });
    }

    resizer._observeRoot(rootRef!);
    scroller._observe(rootRef!);

    onCleanup(() => {
      if (props.ref) {
        props.ref();
      }

      unsubscribeStore();
      unsubscribeOnScroll();
      unsubscribeOnScrollEnd();
      resizer._dispose();
      scroller._dispose();
    });
  });

  createComputed(
    on(
      () => props.data.length,
      (len, prevLen) => {
        if (exists(prevLen) && len !== prevLen) {
          store._update(ACTION_ITEMS_LENGTH_CHANGE, [len, props.shift]);
        }
      }
    )
  );

  createEffect(
    on(jumpCount, () => {
      scroller._fixScrollJump();
    })
  );

  createEffect(() => {
    const next = range();
    props.onRangeChange && props.onRangeChange(next[0], next[1]);
  });

  return (
    <div
      {...attrs}
      ref={rootRef}
      style={{
        display: horizontal ? "inline-block" : "block",
        [horizontal ? "overflow-x" : "overflow-y"]: "auto",
        contain: "strict",
        width: "100%",
        height: "100%",
        ...props.style,
      }}
    >
      <div
        style={{
          // contain: "content",
          "overflow-anchor": "none", // opt out browser's scroll anchoring because it will conflict to scroll anchoring of virtualizer
          flex: "none", // flex style on parent can break layout
          position: "relative",
          visibility: "hidden",
          width: horizontal ? totalSize() + "px" : "100%",
          height: horizontal ? "100%" : totalSize() + "px",
          [horizontal ? "min-width" : "min-height"]: minSize() + "px",
          "pointer-events": scrollDirection() !== SCROLL_IDLE ? "none" : "auto",
        }}
      >
        <RangedFor
          _each={props.data}
          _range={overscanedRange()}
          _render={(data, index) => {
            const offset = createMemo(() => {
              rerender();
              return store._getItemOffset(index);
            });
            const hide = createMemo(() => {
              rerender();
              return store._isUnmeasuredItem(index);
            });

            return (
              <ListItem
                _index={index}
                _resizer={resizer._observeItem}
                _offset={offset()}
                _hide={hide()}
                _children={props.children(data, index)}
                _isHorizontal={horizontal}
              />
            );
          }}
        />
      </div>
    </div>
  );
};