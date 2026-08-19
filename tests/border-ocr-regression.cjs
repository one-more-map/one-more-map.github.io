const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

const { parseBorderOcrPayload } = require('../src/logic/borderOcr.ts')
const { BORDER_MODS } = require('../src/data/mods.ts')

const CURRENT_BORDER_TOOLTIPS = [
  ['b-pack-1', '16% increased Pack Size in adjacent Areas'],
  ['b-pack-2', '24% increased Pack Size in adjacent Areas'],
  ['b-pack-3', '32% increased Pack Size in adjacent Areas'],
  ['b-minmagic', 'Monsters in adjacent Areas are at least Magic'],
  ['b-rare-1', '50% increased number of Rare Monsters in adjacent Areas'],
  ['b-rare-2', '75% increased number of Rare Monsters in adjacent Areas'],
  ['b-rare-3', '100% increased number of Rare Monsters in adjacent Areas'],
  ['b-beasts-1', 'Adjacent Areas contain 8 additional packs of Sea Beasts'],
  ['b-beasts-2', 'Adjacent Areas contain 12 additional packs of Sea Beasts'],
  ['b-beasts-3', 'Adjacent Areas contain 16 additional packs of Sea Beasts'],
  ['b-crabs-1', 'Adjacent Areas contain 8 additional packs of Crabs'],
  ['b-crabs-2', 'Adjacent Areas contain 12 additional packs of Crabs'],
  ['b-crabs-3', 'Adjacent Areas contain 16 additional packs of Crabs'],
  ['b-drowned-1', 'Adjacent Areas contain 8 additional packs of the Drowned'],
  ['b-drowned-2', 'Adjacent Areas contain 12 additional packs of the Drowned'],
  ['b-drowned-3', 'Adjacent Areas contain 16 additional packs of the Drowned'],
  ['b-mag-1', 'Adjacent Areas have 40% increased explicit modifier magnitudes'],
  ['b-mag-2', 'Adjacent Areas have 60% increased explicit modifier magnitudes'],
  ['b-mag-3', 'Adjacent Areas have 80% increased explicit modifier magnitudes'],
  [
    'b-keep-1',
    'Adjacent Charts have 30% chance to not be consumed when beginning a Voyage',
  ],
  [
    'b-keep-2',
    'Adjacent Charts have 50% chance to not be consumed when beginning a Voyage',
  ],
  ['b-octoboss', 'Adjacent Areas contain Filthscrabble'],
  [
    'b-lanterns',
    'Placing Lanterns does not reduce your Lantern count in adjacent Areas',
  ],
  [
    'b-ancient',
    'Rare Monsters in adjacent Areas drop an additional Ancient Orb',
  ],
  ['b-divine', 'Rare Monsters in adjacent Areas drop an additional Divine Orb'],
  [
    'b-exalt',
    'Rare Monsters in adjacent Areas drop an additional Exalted Orb',
  ],
  [
    'b-annul',
    'Rare Monsters in adjacent Areas drop an additional Orb of Annulment',
  ],
  ['b-chaos', 'Rare Monsters in adjacent Areas drop an additional Chaos Orb'],
  ['b-vaal', 'Rare Monsters in adjacent Areas drop an additional Vaal Orb'],
  [
    'b-gcp',
    "Rare Monsters in adjacent Areas drop an additional Gemcutter's Prism",
  ],
  [
    'b-chrome',
    'Rare Monsters in adjacent Areas drop an additional Chromatic Orb',
  ],
  [
    'b-regret',
    'Rare Monsters in adjacent Areas drop an additional Orb of Regret',
  ],
  [
    'b-blessed',
    'Rare Monsters in adjacent Areas drop an additional Blessed Orb',
  ],
  ['b-regal', 'Rare Monsters in adjacent Areas drop an additional Regal Orb'],
  [
    'b-support',
    'Rare Monsters in adjacent Areas have 20% chance to drop a Support Gem',
  ],
  ['b-locker', "Adjacent Areas contain a lost Pirate's Locker"],
  ['b-pirates', 'Adjacent Areas contain a Brinerot raiding party'],
  [
    'b-rareconn-1',
    '50% increased number of Rare monsters in adjacent Areas per connection',
  ],
  [
    'b-rareconn-2',
    '75% increased number of Rare monsters in adjacent Areas per connection',
  ],
  [
    'b-quantconn-1',
    '50% reduced quantity of items found in adjacent Areas per connection\n120% increased Quantity of Items found in adjacent Areas',
  ],
  [
    'b-quantconn-2',
    '50% reduced quantity of items found in adjacent Areas per connection\n180% increased Quantity of Items found in adjacent Areas',
  ],
  [
    'b-gold-1',
    '25% of Equipment dropped by monsters in adjacent Areas is converted to Gold',
  ],
  [
    'b-gold-2',
    '50% of Equipment dropped by monsters in adjacent Areas is converted to Gold',
  ],
  [
    'b-decks',
    'Basic Currency items dropped by Monsters in adjacent Areas will instead drop as Stacked Decks',
  ],
  [
    'b-scarabdrop',
    'Rare Monsters in adjacent Areas drop an additional Scarab',
  ],
  ['b-curr-1', '50% more Currency found in adjacent Areas'],
  ['b-curr-2', '75% more Currency found in adjacent Areas'],
  ['b-curr-3', '100% more Currency found in adjacent Areas'],
  ['b-scarab-1', '50% more Scarabs found in adjacent Areas'],
  ['b-scarab-2', '75% more Scarabs found in adjacent Areas'],
  ['b-scarab-3', '100% more Scarabs found in adjacent Areas'],
  ['b-rarity-1', '50% more Rarity of Items found in adjacent Areas'],
  ['b-rarity-2', '75% more Rarity of Items found in adjacent Areas'],
  ['b-rarity-3', '100% more Rarity of Items found in adjacent Areas'],
  ['b-crabboss', 'Adjacent Areas contain Captainsbane'],
  ['b-exp-1', 'Players in adjacent Areas gain 100% increased Experience'],
  ['b-exp-2', 'Players in adjacent Areas gain 150% increased Experience'],
  ['b-exp-3', 'Players in adjacent Areas gain 200% increased Experience'],
  [
    'b-magicmods',
    'Magic Monsters in adjacent Areas have an additional modifier',
  ],
  ['b-anchor-1', 'Adjacent Areas contain 2 additional Treasure Anchors'],
  ['b-anchor-2', 'Adjacent Areas contain 4 additional Treasure Anchors'],
  [
    'b-sulphdrop',
    "Rare Monsters in adjacent Areas drop Dead Man's Sulphur",
  ],
  ['b-goldlantern', 'Adjacent Areas contain 4 additional Golden Lanterns'],
  ['b-izaro', 'Adjacent Areas contain 2 Altars to the Goddess'],
]

const block = (text, index = 0) =>
  `=== VOYAGE BORDER ${index} ===\n${text}\n=== END VOYAGE BORDER ===`

assert.equal(CURRENT_BORDER_TOOLTIPS.length, 64)

for (const [expectedId, tooltip] of CURRENT_BORDER_TOOLTIPS) {
  const result = parseBorderOcrPayload(block(tooltip))
  assert.equal(
    result.matches[0]?.id,
    expectedId,
    `${expectedId} was parsed as ${result.matches[0]?.id ?? 'MISS'}: ${tooltip}`,
  )
}

let legacyAliasCount = 0
for (const mod of BORDER_MODS) {
  for (const alias of mod.aliases ?? []) {
    legacyAliasCount++
    const result = parseBorderOcrPayload(block(alias))
    assert.equal(
      result.matches[0]?.id,
      mod.id,
      `${mod.id} alias was parsed as ${result.matches[0]?.id ?? 'MISS'}: ${alias}`,
    )
  }
}
assert.equal(legacyAliasCount, 12)

const unknown = parseBorderOcrPayload(block('Adjacent Areas contain TotallyUnknownBoss'))
assert.equal(unknown.matches.length, 0)
assert.equal(unknown.misses.length, 1)

const noisyFilthscrabble = parseBorderOcrPayload(
  block('Adjacent Areas contain Filthscrabblc'),
)
assert.equal(noisyFilthscrabble.matches[0]?.id, 'b-octoboss')

const baseRare = parseBorderOcrPayload(
  block('50% increased number of Rare Monsters in adjacent Areas', 0),
)
const rarePerConnection = parseBorderOcrPayload(
  block(
    '50% increased number of Rare monsters in adjacent Areas per connection',
    1,
  ),
)
assert.equal(baseRare.matches[0]?.id, 'b-rare-1')
assert.equal(rarePerConnection.matches[0]?.id, 'b-rareconn-1')

const noisyRarePerConnection = parseBorderOcrPayload(
  block(
    '50% increased number of Rare monsters in adjacent Areas per connectlon',
    2,
  ),
)
assert.equal(noisyRarePerConnection.matches[0]?.id, 'b-rareconn-1')

// The collector's whole compliance story is that it never sends any input
// to the game: it may watch the clipboard the player copied to and read a
// screenshot taken while the PLAYER holds Alt, but game-input primitives
// must never appear in it.
const collector = fs
  .readFileSync(require.resolve('../public/voyage-clip-collector.ahk'), 'utf8')
  .replace(/\r\n?/g, '\n')
assert.match(collector, /OnClipboardChange/)
assert.match(collector, /아이템 종류/, 'must recognise Korean chart headers')
assert.match(collector, /F8:: RunBorderScan/, 'F8 border scan must exist')
assert.doesNotMatch(
  collector,
  /\b(Send|SendInput|SendEvent|SendText|Click|MouseMove|MouseClick|ControlSend|ControlClick|WinActivate|PostMessage|SendMessage)\b/,
  'the collector must never contain a game-input primitive',
)

// the embedded border-reading helper: proven pipeline pieces must be present
// and it must contain zero backticks (AutoHotkey strips them when writing
// the helper to disk)
const psStart = collector.indexOf('return "\n(\n')
const psEnd = collector.indexOf('\n)"', psStart)
assert.ok(psStart > 0 && psEnd > psStart, 'embedded helper not found')
const helperPs = collector.slice(psStart + 'return "\n(\n'.length, psEnd)
assert.ok(!helperPs.includes('`'), 'embedded PowerShell must not contain backticks')
assert.match(helperPs, /Resolve-BorderAssignment/, '2-opt assignment must be embedded')
assert.match(helperPs, /adjacent\|areas\|voyage\|인접\|지역\|항해/, 'loot-label keyword gate must be embedded')
assert.match(helperPs, /VoyageOcrImage\]::Normalize/, 'contrast-stretch rescue must be embedded')
assert.match(helperPs, /\$PointSpec/, 'points param must not collide with the local $points variable')

console.log('Border OCR regression: 64/64 current tooltips and 12/12 aliases matched; collector is input-free')
