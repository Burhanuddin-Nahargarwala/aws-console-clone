const KEY = 'floci_region';
export const getRegion = () => localStorage.getItem(KEY) || 'ap-south-1';
export const setRegion = (code) => localStorage.setItem(KEY, code);
