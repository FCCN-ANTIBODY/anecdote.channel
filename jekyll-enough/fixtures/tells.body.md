
# Tells

Atlas is a **directory of Tells** — the jurisdiction hubs that front data-piles. Each Tell listed here
registered by a signed PR (see [the contract](/CONTRACT.md) → "Registering a Tell"); the `signer`
fingerprint is the open anchor of its ownership. Machine-readable at [`/tells.json`](/tells.json).

A pile is reached *through* its Tell. The piles grouped behind each Tell are shown beneath it; their
coarse public maps render on the [home page](/).

<ul class="tells">
{%- for tell in site.data.tells -%}
  <li>
    <strong><a href="{{ tell.url }}">{{ tell.name | default: tell.id }}</a></strong>
    <small>— {{ tell.scope }}</small>
    <br><small>signer: <code>{{ tell.signer }}</code>{% if tell.reports and tell.reports != "" %} · reports: <code>{{ tell.reports }}</code>{% endif %}</small>
    {%- assign behind = site.data.piles | where: "tell", tell.id -%}
    {%- if behind and behind.size > 0 %}
    <ul class="behind">
      {%- for pile in behind -%}
      <li>{{ pile.name | default: pile.id }} <small>— {{ pile.level }} · <a href="{{ pile.map }}">map</a></small></li>
      {%- endfor -%}
    </ul>
    {%- else %}
    <br><small><em>no piles grouped behind this Tell yet</em></small>
    {%- endif -%}
  </li>
{%- endfor -%}
</ul>

<p>To list a Tell is to require its transparency and to guarantee its aggregation: Atlas
<strong>affirmatively escalates</strong> every report a listed Tell publishes into all the constituency
aggregations it belongs to, and keeps an <strong>open line</strong> — no strictness gate — whose
reports gain weight and credibility as they accumulate. See the
<a href="/CONSTITUTION.md">constitution</a>.</p>
