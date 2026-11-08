/* Visitor analytics (PostHog, EU region). Loads only after the page has finished and the browser is
   idle, so it never competes with the first paint or the 3D scenes. No cookies: state lives in
   sessionStorage and dies with the tab, so a visit across several pages counts as one session.
   Runs on the live domain only; add ?analytics to a local URL to test it. */
(function () {
  var live = /(^|\.)luizkim\.com$/.test(location.hostname);
  if (!live && !/[?&]analytics\b/.test(location.search)) return;

  function start() {
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
