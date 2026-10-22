/** Set by the language provider so a server message (always Arabic) is shown in the page language. */
let translateMessage: (message: string) => string = message => message;
export const setMessageTranslator = (fn: (message: string) => string) => { translateMessage = fn; };
export async function requestJSON(path: string, method = 'GET', data?: unknown) {
  const preview=typeof window!=='undefined'?window.location.pathname.match(/^\/coverage-preview\/([^/]+)/)?.[1]:undefined;
  if(preview&&path.startsWith('/api/')&&!path.startsWith('/api/coverage-preview/'))path='/api/coverage-preview/'+preview+path.slice(4);
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: data === undefined ? undefined : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(translateMessage(result.error || 'تعذر إتمام الطلب'));
  return result;
}
