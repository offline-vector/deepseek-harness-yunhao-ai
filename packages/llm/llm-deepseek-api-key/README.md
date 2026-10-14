---
description: "S1API api-key authentication and model discovery for the Messages-compatible route."
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-deepseek-api-key

English | [中文](README.zh.md)

## Summary

Register authentication and model discovery for the S1API-backed `deepseek-official` route. This plugin shares the [Messages transport](../llm-deepseek/README.md) and owns credential resolution and catalog availability. The internal route id remains `deepseek-official` for compatibility with existing settings and sessions.

Authentication resolution returns the validated API key in `x-api-key` for both Messages and Files requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use-this-package"></a>
## Use this package

`apiKeyEnv` defaults to `DEEPSEEK_API_KEY` for compatibility with the upstream configuration and resolves per request and model discovery. In the product UI the key is presented as an S1API key. When the credentials service exists, its precedence applies; only compositions without that service read the launch environment directly. Requests with missing credentials fail with `MISSING_CREDENTIAL`; malformed credentials fail with `INVALID_CREDENTIAL`. Model discovery returns an empty catalog when the credential is missing, hiding the route from model selectors while retaining its settings entry. Malformed credentials and other lookup failures propagate. Adding or removing a key affects the next discovery call.

```yaml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    reasoningEffort: high
    apiKeyEnv: DEEPSEEK_API_KEY
```

The endpoint and credential reference come from one configuration resolution. In-flight requests retain that snapshot; subsequent updates affect subsequent calls. Account login state cannot change this route’s credential.

`models` is an independently configurable catalog for this provider; defaults and protocol capabilities come from the shared transport. Discovery does not probe inference endpoints. The settings namespace is the Cordis entry id, or the plugin name without an entry. Product profiles retain the official entry id `llm-deepseek` and use `llm-deepseek-account` for the account route.

<a id="understand-the-implementation"></a>
## Understand the implementation

Registrations and listeners dispose with the plugin. Shared Host wiring supplies attachments, request extensions, anonymous identity, and atomic retry-policy updates; this plugin registers only its own route.

<a id="further-exploration"></a>
## Further Exploration

[LLM streaming](../../../docs/subsystems/llm-streaming.md) · [Messages](../llm-deepseek/README.md)

<a id="model-experience"></a>
## Model Experience

### Authenticated model requests

#### What the model sees

Requests on the S1API-backed `deepseek-official` route add no model-visible text from this plugin; the shared Messages transport serializes requests.

#### Token effect

Authentication and discovery add no input tokens; the selected model and request content determine actual usage.

#### KV Cache effect

Credentials and catalog availability do not enter model input; the protocol transport owns request-prefix serialization.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The catalog is configuration metadata, not remote validation that a model is accepted; actual calls can still fail.

<a id="dev-note"></a>
### Dev Note

Registration and authentication tests also cover the Loader composition in the shared transport package.
