import * as WebBrowser from "expo-web-browser";
import { WEB_BASE_URL } from "./config";
import { supabase } from "./supabase";

// Opens a web page in the in-app browser. With `auth`, the current Supabase
// session is handed to the web app (tokens travel in the URL fragment, which
// never reaches the server) so the user lands signed in instead of on /login.
export async function openWeb(path: string, opts: { auth?: boolean } = {}) {
  let url = `${WEB_BASE_URL}${path}`;
  if (opts.auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const hash = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      url = `${WEB_BASE_URL}/auth/handoff?next=${encodeURIComponent(path)}#${hash.toString()}`;
    }
  }
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: "close",
  });
}
