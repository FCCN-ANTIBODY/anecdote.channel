---
layout: default
title: null
---

# Anecdote

**Anecdote** is the apex of the `anecdote.channel` constellation — a **reflection API** over
moderated snapshots ("maps") published by data-piles. Where the city-level civic nodes
(e.g. [Atlas](https://atlas.anecdote.channel)) reflect their own jurisdiction, Anecdote reflects
the **encompassing** physical-space hierarchies that contain them: county, major election
districts, climate zone, watershed, and up.

Each pile keeps its raw answers in a private sink and emits only a small, deliberately *coarse*
public map (relative tiers, never raw counts). Anecdote needs no read token — it only ever sees
approved, low-bandwidth output, and rebuilds when a pile fires a `pile-updated` notification.

## Reflected piles

{% assign piles = site.data.reflected_piles %}
{% if piles and piles.size > 0 %}
{% assign levels = piles | group_by: "level" %}
{% for level in levels %}
<h3 class="level-group">{{ level.name | default: "uncategorized" }}</h3>
<ul class="pile-index">
  {% for pile in level.items %}
  <li>
    <a href="{{ pile.url | relative_url }}">{{ pile.name }}</a>
    {% if pile.region %}<span class="meta">{{ pile.region.name }}</span>{% endif %}
    {% if pile.updated_at %}<span class="meta">updated {{ pile.updated_at }}</span>{% endif %}
  </li>
  {% endfor %}
</ul>
{% endfor %}
{% else %}
<p>No piles are currently reflected. Add one to <code>_data/piles.yml</code>.</p>
{% endif %}

## The constellation

- [atlas.anecdote.channel](https://atlas.anecdote.channel) — civic-node reflection connector.
- Additional civic nodes (e.g. `fortcollins`, `loveland`) come online as their piles publish maps.
