import {
  Children,
  memo,
  useState,
  useRef,
  useMemo,
  CSSProperties,
  ReactElement,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
  ReactNode,
} from "react";
import {
  computeStartOffset,
  findEndIndex,
  resolveItemSize,
  UNCACHED_ITEM_SIZE,
} from "./cache";
import {
  HANDLE_ITEM_INTERSECTION,
  HANDLE_SCROLL,
  RESET_CACHE,
  UPDATE_ITEM_SIZES,
  UPDATE_VIEWPORT_SIZE,
  useVirtualState,
} from "./state";
import type { ObserverHandle } from "./types";
import { debounce, max, min } from "./utils";

const DEFAULT_ITEM_MARGIN_COUNT = 2;
const DEFAULT_ITEM_SIZE = 40; // 50

type ItemProps = {
  children: ReactNode;
  _handle: ObserverHandle;
  _index: number;
  _top: number;
  _hide: boolean;
};

const Item = memo(
  ({
    children,
    _handle,
    _index,
    _top: top,
    _hide: hide,
  }: ItemProps): ReactElement => {
    const ref = useRef<HTMLDivElement>(null);

    const style = useMemo<CSSProperties>(
      () => ({
        margin: "0",
        padding: "0",
        position: "absolute",
        width: "100%",
        top,
        ...(hide && {
          visibility: "hidden",
        }),
      }),
      [top, hide]
    );

    useLayoutEffect(() => _handle._observe(ref.current!, _index), []);

    return (
      <div ref={ref} style={style}>
        {children}
      </div>
    );
  }
);

export type ListHandle = {
  scrollTo(index: number): void;
};

export type ListProps = {
  children: ReactNode;
  itemHeight?: number;
  itemMargin?: number;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
};

export const List = forwardRef<ListHandle, ListProps>(
  (
    {
      children,
      itemHeight = DEFAULT_ITEM_SIZE,
      itemMargin = DEFAULT_ITEM_MARGIN_COUNT,
      style: styleProp,
      innerStyle: innerStyleProp,
    },
    ref
  ): ReactElement => {
    const rootRef = useRef<HTMLDivElement>(null);
    // memoize element instances
    const elements = useMemo(() => Children.toArray(children), [children]);

    const [
      {
        _startIndex: startIndex,
        _viewportSize: viewportHeight,
        _cache: cache,
        _jump: jump,
      },
      dispatch,
    ] = useVirtualState(elements, itemHeight);

    const handle = useState((): ObserverHandle => {
      let ro: ResizeObserver;
      let io: IntersectionObserver;

      let viewedCount = 0;

      const mountedIndexes = new WeakMap<Element, number>();
      const viewedIndexes = new WeakMap<Element, number>();

      return {
        _init(root) {
          // Estimating scroll position from intersections can fail when items were mounted outside of viewport and intersection didn't happen.
          // This situation rarely occurs in fast scrolling with scroll bar.
          // So get scroll position from element while there are no items in viewport.
          const requestSync = debounce(() => {
            if (viewedCount) return;

            dispatch({
              _type: HANDLE_SCROLL,
              _offset: root.scrollTop,
            });
            requestSync();
          }, 200);

          ro = new ResizeObserver((entries) => {
            const resizedItemHeights: number[] = [];
            const resizedItemIndexes: number[] = [];
            for (const entry of entries) {
              if (entry.target === root) {
                dispatch({
                  _type: UPDATE_VIEWPORT_SIZE,
                  _size: entry.contentRect.height,
                });
              } else {
                const index = mountedIndexes.get(entry.target);
                if (index != null) {
                  resizedItemHeights.push(entry.contentRect.height);
                  resizedItemIndexes.push(index);
                }
              }
            }

            if (resizedItemHeights.length) {
              dispatch({
                _type: UPDATE_ITEM_SIZES,
                _sizes: resizedItemHeights,
                _indexes: resizedItemIndexes,
              });
            }
          });

          io = new IntersectionObserver(
            (entries) => {
              let latestEntry: IntersectionObserverEntry | undefined;
              entries.forEach((entry) => {
                // take latest entry
                if (
                  (!latestEntry || latestEntry.time < entry.time) &&
                  mountedIndexes.has(entry.target)
                ) {
                  latestEntry = entry;
                }

                if (entry.isIntersecting) {
                  // enter
                  const index = mountedIndexes.get(entry.target);
                  if (index != null) {
                    viewedIndexes.set(entry.target, index);
                    viewedCount++;
                  }
                } else {
                  // exit
                  if (viewedIndexes.has(entry.target)) {
                    viewedIndexes.delete(entry.target);
                    viewedCount--;
                  }
                }
              });

              if (!viewedCount) {
                // all items would exit in fast scrolling
                dispatch({
                  _type: HANDLE_SCROLL,
                  _offset: root.scrollTop,
                });

                requestSync();
                return;
              }

              if (latestEntry) {
                dispatch({
                  _type: HANDLE_ITEM_INTERSECTION,
                  _index: mountedIndexes.get(latestEntry.target)!,
                  _offset:
                    latestEntry.boundingClientRect.top -
                    latestEntry.rootBounds!.top,
                });
              }
            },
            {
              root: root,
              threshold: 1,
            }
          );

          ro.observe(root);
          return () => {
            ro.disconnect();
            io.disconnect();
            requestSync._cancel();
          };
        },
        _observe(el, i) {
          mountedIndexes.set(el, i);
          ro.observe(el);
          io.observe(el);
          return () => {
            mountedIndexes.delete(el);
            if (viewedIndexes.has(el)) {
              viewedIndexes.delete(el);
              viewedCount--;
            }
            ro.unobserve(el);
            io.unobserve(el);
          };
        },
      };
    })[0];

    const scrollHeight = cache.reduce(
      (acc, c) => acc + resolveItemSize(c, itemHeight),
      0
    );

    const items: (ReactElement | null)[] = [];
    const endIndex = useMemo(
      () => findEndIndex(startIndex, viewportHeight, cache, itemHeight),
      [cache, startIndex, viewportHeight, itemHeight]
    );

    const startIndexWithMargin = max(startIndex - itemMargin, 0);
    const endIndexWithMargin = min(endIndex + itemMargin, cache.length - 1);

    useLayoutEffect(() => handle._init(rootRef.current!), []);

    useLayoutEffect(() => {
      dispatch({
        _type: RESET_CACHE,
        _elements: elements,
      });
    }, [elements.length]);

    useLayoutEffect(() => {
      if (rootRef.current) {
        if (
          jump._start &&
          !(startIndex === 0 && rootRef.current.scrollTop === 0)
        ) {
          rootRef.current.scrollTop += jump._start;
        }
        if (jump._end && endIndex - (cache.length - 1) === 0) {
          rootRef.current.scrollTop += jump._end;
        }
      }
    }, [jump]);

    useImperativeHandle(ref, () => ({
      scrollTo(index) {
        if (rootRef.current) {
          let top = computeStartOffset(index, cache, itemHeight);
          if (scrollHeight - (top + viewportHeight) <= 0) {
            top = scrollHeight - viewportHeight;
          }
          rootRef.current.scrollTop = top;
        }
      },
    }));

    let offset = useMemo(
      () => computeStartOffset(startIndexWithMargin, cache, itemHeight),
      [cache, startIndexWithMargin, itemHeight]
    );
    for (let i = startIndexWithMargin; i <= endIndexWithMargin; i++) {
      // elements could be undefined when children length changed
      const e = elements[i];
      items.push(
        e ? (
          <Item
            key={(e as { key?: ReactElement["key"] }).key || i}
            _handle={handle}
            _index={i}
            _top={offset}
            _hide={cache[i] === UNCACHED_ITEM_SIZE}
          >
            {e}
          </Item>
        ) : null
      );
      offset += resolveItemSize(cache[i]!, itemHeight);
    }

    return (
      <div
        ref={rootRef}
        style={useMemo<CSSProperties>(
          () => ({
            width: "100%",
            height: "100%",
            overflowY: "auto",
            ...styleProp,
          }),
          [styleProp]
        )}
      >
        <div
          style={useMemo<CSSProperties>(
            () => ({
              position: "relative",
              width: "100%",
              height:
                scrollHeight >= viewportHeight ? scrollHeight : viewportHeight,
              ...innerStyleProp,
            }),
            [scrollHeight, viewportHeight, innerStyleProp]
          )}
        >
          {viewportHeight !== 0 && items}
        </div>
      </div>
    );
  }
);
