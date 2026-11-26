/* Visitor analytics (PostHog, EU region). Loads only after the page has finished and the browser is
   idle, so it never competes with the first paint or the 3D scenes. No cookies: state lives in
   sessionStorage and dies with the tab, so a visit across several pages counts as one session.
   Runs on the live domain only; add ?analytics to a local URL to test it.
   Two kinds of visit are never counted:
   - The owner's: open any page with ?notrack once and this browser stays uncounted; ?track undoes it.
   - Headless robots: automated browsers, and desktop windows with no browser frame at all. */
(function () {
  var query = location.search;
  var live = /(^|\.)luizkim\.com$/.test(location.hostname);
  if (!live && !/[?&]analytics\b/.test(query)) return;

  /* The owner's switch. The choice lives in localStorage, so it outlasts the tab and the session. */
  var OFF_KEY = 'analytics-off';
  var off = /[?&]notrack\b/.test(query);
  var on = !off && /[?&]track\b/.test(query);
  try {
    if (off) localStorage.setItem(OFF_KEY, '1');
    else if (on) localStorage.removeItem(OFF_KEY);
    else off = localStorage.getItem(OFF_KEY) === '1';
  } catch (e) { /* storage blocked: the switch then holds for this page only */ }
  if (/[?&](no)?track\b/.test(query)) alert(off ? 'Analytics is off in this browser.' : 'Analytics is on in this browser.');
  if (off) return;

  /* A robot that poses as a normal browser still gives itself away: it says it is automated, or its
     page fills the whole screen (no address bar, no tabs) on a device without touch. A person in
     full-screen mode looks the same and is skipped too; that is the accepted cost. */
  function robot() {
    if (navigator.webdriver) return true;
    return !navigator.maxTouchPoints && screen.width > 0 &&
      window.innerWidth === screen.width && window.innerHeight === screen.height;
  }

  function start() {
    if (robot()) return;
    /* PostHog's standard loader stub: it queues calls and fetches the library (array.js). */
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags on onFeatureFlags onSessionId identify setPersonProperties group resetGroups reset get_distinct_id get_session_id alias set_config startSessionRecording stopSessionRecording captureException opt_in_capturing opt_out_capturing has_opted_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    window.posthog.init('phc_qdPSCPjT4mFsGstRtxcSoDgZqGUrhR7hWKyLXUg5c7GZ', {
      api_host: 'https://eu.i.posthog.com',
      persistence: 'sessionStorage',        // no cookies
      person_profiles: 'identified_only',   // anonymous visitors stay anonymous
      enable_heatmaps: true
    });
  }

  /* The claw machine's prize, so the dashboard shows who plays and which look they win. */
  document.addEventListener('claw:caught', function (e) {
    if (window.posthog && window.posthog.capture) window.posthog.capture('claw_caught', e.detail || {});
  });

  function whenIdle() { ('requestIdleCallback' in window) ? requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 2000); }
  if (document.readyState === 'complete') whenIdle();
  else addEventListener('load', whenIdle, { once: true });
})();
