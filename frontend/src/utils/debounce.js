/** 合并连续调用，只在最后一次调用后执行；cancel 用于重置或卸载时撤销。 */
export function createDebouncedAction(action, delay = 300) {
  let timer;
  const run = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      action(...args);
    }, delay);
  };
  run.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return run;
}
