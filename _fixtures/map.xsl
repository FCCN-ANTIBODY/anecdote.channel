<?xml version="1.0" encoding="UTF-8"?>
<!--
  Stylesheet for the published map. Its purpose is intentionality: opening the
  raw map.xml directly in a browser renders this human-readable view, signalling
  exactly how the document is meant to be leveraged. Anecdote itself parses the XML.

  Geography is shown as a typed region (county / district / climate-zone /
  watershed); a legacy <district> element is also rendered for cross-compat.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/map">
    <html>
      <head>
        <title>Map — <xsl:value-of select="@poll-id"/></title>
        <style>
          body { font: 16px/1.5 system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
          h1 { font-size: 1.25rem; }
          .meta { color: #666; font-size: 0.85rem; }
          .level { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; text-transform: uppercase; background: #eee; }
          .tier { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; text-transform: uppercase; }
          .tier-low { background: #eef; } .tier-med { background: #ffe; } .tier-high { background: #efe; }
          li { margin: 0.4rem 0; }
        </style>
      </head>
      <body>
        <h1><xsl:value-of select="question"/></h1>
        <p class="meta">
          <xsl:choose>
            <xsl:when test="region">
              <xsl:value-of select="region/@name"/>
              <xsl:text> </xsl:text>
              <span class="level"><xsl:value-of select="region/@type"/></span>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="district/@name"/>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text> · poll </xsl:text>
          <xsl:value-of select="@poll-id"/>
          <xsl:text> · updated </xsl:text>
          <xsl:value-of select="@updated-at"/>
        </p>
        <ul>
          <xsl:for-each select="options/option">
            <li>
              <xsl:value-of select="@label"/>
              <xsl:text> </xsl:text>
              <span class="tier tier-{tier}"><xsl:value-of select="tier"/></span>
            </li>
          </xsl:for-each>
        </ul>
        <p class="meta">
          <xsl:value-of select="totals/@accepted"/> accepted responses.
        </p>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
