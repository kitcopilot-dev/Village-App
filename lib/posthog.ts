import posthog from 'posthog-js'

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    posthog.init('phc_development_key', {
      api_host: 'https://posthog.exe.xyz',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog initialized')
        }
      },
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: false,
    })
  }
  return posthog
}

export default posthog
