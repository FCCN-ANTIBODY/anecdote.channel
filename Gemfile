source "https://rubygems.org"

# Custom GitHub Pages build (via Actions) rather than GitHub's managed
# Pages-Jekyll, so we control the Jekyll version and may add arbitrary plugins.
gem "jekyll", "~> 4.3"

# Plugins live here. The custom reflection generator in _plugins/ is loaded
# directly by Jekyll and needs no gem; add published plugins below as desired.
group :jekyll_plugins do
  # gem "jekyll-feed", "~> 0.17"
end

# Webrick is no longer a default gem on Ruby 3.x; Jekyll's local server needs it.
gem "webrick", "~> 1.8"
