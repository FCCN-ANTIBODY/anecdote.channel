# Anecdote reflection generator.
#
# For each data-pile in _data/piles.yml, fetch its published XML "map" (the
# canonical contract artifact), parse it, and reflect it into the site: one
# detail page per pile, plus a normalized summary list for the index.
#
# Anecdote is the apex connector: it reflects *encompassing* physical-space
# hierarchies (county, election districts, climate zone, watershed) one notch
# larger than the city-level civic nodes. The map schema is the same coarse-tier
# contract used across the constellation, generalized so the geography element
# carries a type/level (see CONTRACT.md). The parser also accepts Atlas's
# <district> element (treated as type "district") for cross-compat.
#
# Network reads are public by design ("private sink, public artifacts"), so no
# token is required. An optional ANECDOTE_PILE_TOKEN is sent as a bearer header
# to support future private-artifact piles; if a remote fetch fails we fall back
# to the entry's local `fixture` so the build always succeeds offline.

require "rexml/document"

module Anecdote
  # A generated detail page for one reflected pile. Carries the normalized map
  # data as `page.pile` for _layouts/pile.html to render.
  class PilePage < Jekyll::Page
    def initialize(site, base, pile)
      @site = site
      @base = base
      @dir  = "/#{pile['id']}/"
      @name = "index.html"
      process(@name)
      @data = {
        "layout" => "pile",
        "title"  => pile["name"],
        "pile"   => pile,
      }
    end
  end

  class ReflectionGenerator < Jekyll::Generator
    safe false        # we perform network IO
    priority :high    # populate site.data before pages render

    def generate(site)
      entries = site.data["piles"] || []
      reflected = []

      entries.each do |entry|
        pile = reflect(site, entry)
        next unless pile

        site.pages << PilePage.new(site, site.source, pile)
        reflected << pile
        Jekyll.logger.info "Anecdote:", "reflected #{pile['id']} (#{pile['updated_at']})"
      end

      # Sorted newest-first for the index.
      site.data["reflected_piles"] = reflected.sort_by { |p| p["updated_at"].to_s }.reverse
    end

    private

    def reflect(site, entry)
      xml = fetch_xml(site, entry)
      return nil unless xml

      parse_map(xml, entry)
    rescue StandardError => e
      Jekyll.logger.warn "Anecdote:", "could not reflect #{entry['id']}: #{e.message}"
      nil
    end

    def fetch_xml(site, entry)
      url = entry["url"]
      if url && !url.empty?
        begin
          return http_get(url)
        rescue StandardError => e
          Jekyll.logger.warn "Anecdote:", "fetch failed for #{entry['id']} (#{e.message}); trying fixture"
        end
      end

      fixture = entry["fixture"]
      if fixture
        path = File.join(site.source, fixture)
        return File.read(path) if File.exist?(path)
        Jekyll.logger.warn "Anecdote:", "fixture not found for #{entry['id']}: #{fixture}"
      end

      Jekyll.logger.warn "Anecdote:", "no usable source for #{entry['id']}"
      nil
    end

    def http_get(url)
      require "open-uri"
      headers = { "User-Agent" => "anecdote-reflection" }
      token = ENV["ANECDOTE_PILE_TOKEN"]
      headers["Authorization"] = "Bearer #{token}" if token && !token.empty?
      URI.parse(url).open(headers, &:read)
    end

    def parse_map(xml, entry)
      doc = REXML::Document.new(xml)
      root = doc.root
      raise "missing <map> root element" unless root && root.name == "map"

      options = []
      root.each_element("options/option") do |o|
        tier = o.elements["tier"]
        options << {
          "id"    => o.attributes["id"],
          "label" => o.attributes["label"],
          "tier"  => tier && tier.text && tier.text.strip,
        }
      end

      region = parse_region(root)

      {
        "id"         => entry["id"],
        "name"       => entry["name"] || root.attributes["poll-id"],
        "poll_id"    => root.attributes["poll-id"],
        "updated_at" => root.attributes["updated-at"],
        "version"    => root.attributes["version"],
        "region"     => region,
        "level"      => region && region["type"],
        "question"   => text(root.elements["question"]),
        "options"    => options,
        "accepted"   => attr(root.elements["totals"], "accepted"),
        "rejected"   => attrs(root.elements["rejected"], "geo", "sig", "malformed", "other"),
        "sampling"   => attrs(root.elements["sampling"], "low", "mid", "high"),
        "url"        => "/#{entry['id']}/",
      }
    end

    # Geography element. Canonical form is <region type="county|district|
    # climate-zone|watershed" id name>; we also accept Atlas's <district> and
    # normalize it to type "district" so any constellation map reflects here.
    def parse_region(root)
      el = root.elements["region"]
      if el
        return {
          "type" => el.attributes["type"],
          "id"   => el.attributes["id"],
          "name" => el.attributes["name"],
        }
      end

      district = root.elements["district"]
      return nil unless district

      {
        "type" => "district",
        "id"   => district.attributes["id"],
        "name" => district.attributes["name"],
      }
    end

    def text(el)
      el && el.text && el.text.strip
    end

    def attr(el, name)
      el && el.attributes[name]
    end

    def attrs(el, *names)
      return nil unless el
      names.each_with_object({}) { |n, h| h[n] = el.attributes[n] }
    end
  end
end
