# The lab's background art

`labs-bg.svg` is the background art behind wickedlabs.ai: the lab behind the wicked tools, the
components and their parts. The flask (its outline is the flask glyph of the family header,
wicked-web's Topbar, drawn eleven times larger), a component diagram, a chip and a beaker; circuit
traces, a test-tube rack, a ring molecule, a nut and bolt; a round-bottom flask and a pin header at the
edges; the lab notebook, a microscope, a dropper and an exploded parts view, wired by dashed connectors
and circuit traces. It is original to this repo.

It is drawn like the product sites' art (wc/ws/wg/we.wickedagile.com): a 1600x900 mask of black strokes
on nothing (stroke 1.4, outlines 1.8, round caps and joins; dashed wires `5 9` with 8x6 arrowheads,
dashed drops `6 10` ending in a node; three dot triples), so the page paints it in its own ink and it
recolours with the theme.

## Using it (the recipe `index.html` follows; the Astro build can reuse it)

- **One fixed layer behind everything**, painted in the ink through the art as a mask, centred and
  cover-sized, never animated (under any motion setting):

  ```css
  body::before {
    content: ''; position: fixed; inset: 0; z-index: -2; pointer-events: none;
    background-color: var(--ink); opacity: .08;            /* .06 in the light theme */
    -webkit-mask: url('art/labs-bg.svg') center / cover no-repeat;
            mask: url('art/labs-bg.svg') center / cover no-repeat;
  }
  ```

  Wrap it in `@supports (color: color-mix(in oklab, red 50%, blue)) and ((mask: none) or
  (-webkit-mask: none))`: a browser that can't draw the veil (below) keeps the plain page instead of
  getting the art without it, and one without masks never paints the ink as a solid block.
  The URL is same-origin and relative to the page; in an Astro build, import the file through Vite
  (a relative `url()` in a style, so it is emitted under the base) or put it in `public/`.
- **A veil behind every block of text**, so the art never lowers text contrast: the page colour at 60%,
  with a soft edge, at `z-index: -1` (above the art, below the glow and the content):

  ```css
  main { position: relative; }
  main::before {
    content: ''; position: absolute; inset: 48px 24px; /* the block's padding: its content box */
    z-index: -1; pointer-events: none; border-radius: 16px;
    --veil: color-mix(in oklab, var(--canvas) 60%, transparent);
    background: var(--veil); box-shadow: 0 0 32px 32px var(--veil);
  }
  ```

  Under text the art is then 0.032 of the ink in dark (0.024 in light), less than the 4% line grid the
  placeholder wore, and at full strength only around the text.
- **The glow stays above the art**: the top-left radial sits on its own layer after the veil, so the
  veil never dims it.
