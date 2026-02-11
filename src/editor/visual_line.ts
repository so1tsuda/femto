export interface CaretMeasure {
  top: number;
  left: number;
}

export function findVisualLineTarget(
  current: number,
  textLength: number,
  direction: -1 | 1,
  currentPos: CaretMeasure,
  measure: (cursor: number) => CaretMeasure,
): number {
  if (textLength === 0) {
    return 0;
  }

  const epsilon = 0.5;
  const currentTop = currentPos.top;
  const probe =
    direction > 0
      ? findFirstIndexWithTopGreater(current, textLength, currentTop + epsilon, measure)
      : findLastIndexWithTopLess(current, currentTop - epsilon, measure);

  if (probe === null) {
    return direction > 0 ? textLength : 0;
  }

  const targetTop = measure(probe).top;
  const rowStart = findRowStart(probe, targetTop, measure);
  const rowEnd = findRowEnd(probe, textLength, targetTop, measure);
  return findClosestLeftInRow(rowStart, rowEnd, currentPos.left, measure);
}

function findFirstIndexWithTopGreater(
  start: number,
  max: number,
  threshold: number,
  measure: (cursor: number) => CaretMeasure,
): number | null {
  if (start >= max) {
    return null;
  }

  let low = start + 1;
  let high = Math.min(max, low + 16);

  while (high < max && measure(high).top <= threshold) {
    low = high + 1;
    high = Math.min(max, high + (high - start) * 2);
  }

  if (measure(high).top <= threshold) {
    return null;
  }

  let left = low;
  let right = high;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (measure(mid).top > threshold) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }
  return left;
}

function findLastIndexWithTopLess(
  start: number,
  threshold: number,
  measure: (cursor: number) => CaretMeasure,
): number | null {
  if (start <= 0) {
    return null;
  }

  let high = start - 1;
  let low = Math.max(0, high - 16);

  while (low > 0 && measure(low).top >= threshold) {
    high = low - 1;
    low = Math.max(0, low - (start - low) * 2);
  }

  if (measure(low).top >= threshold) {
    return null;
  }

  let left = low;
  let right = high;
  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    if (measure(mid).top < threshold) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }
  return left;
}

function findRowStart(
  probe: number,
  rowTop: number,
  measure: (cursor: number) => CaretMeasure,
): number {
  let left = 0;
  let right = probe;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (measure(mid).top >= rowTop - 0.5) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }
  return left;
}

function findRowEnd(
  probe: number,
  max: number,
  rowTop: number,
  measure: (cursor: number) => CaretMeasure,
): number {
  let left = probe;
  let right = max;
  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    if (measure(mid).top <= rowTop + 0.5) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }
  return left;
}

function findClosestLeftInRow(
  start: number,
  end: number,
  targetLeft: number,
  measure: (cursor: number) => CaretMeasure,
): number {
  let left = start;
  let right = end;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (measure(mid).left < targetLeft) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  const candidateA = left;
  const candidateB = Math.max(start, left - 1);
  const diffA = Math.abs(measure(candidateA).left - targetLeft);
  const diffB = Math.abs(measure(candidateB).left - targetLeft);
  return diffB <= diffA ? candidateB : candidateA;
}
