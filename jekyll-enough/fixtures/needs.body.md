
# What's hanging

Questions in the constellation with **no pile yet to catch them** — requests-for-pile this Atlas
carries. A tip line (what's going unanswered in your area) and a board (a job offer, a standing
invite). Machine-readable at [`/needs.json`](/needs.json); published matches at
[`/matches.json`](/matches.json).

<ul class="whats-hanging">
{%- for need in site.data.needs -%}
  <li>
    <strong>{{ need.text | default: need.id }}</strong>
    <small>— {{ need.scope }} · {{ need.topic }}</small>
    {%- if need.terms and need.terms != "" %} <em>(usable as-is: {{ need.terms }})</em>{% endif -%}
    <br><a href="{{ need.need_url }}">{{ need.asker_repo }}#{{ need.id }}</a>
  </li>
{%- endfor -%}
</ul>

<p>A pile whose constitution fits one of these is matched by Atlas; the asker pulls the match and
re-issues directly — consent intact. Atlas never reaches into anyone.</p>
