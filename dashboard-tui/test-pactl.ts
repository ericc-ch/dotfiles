import { listAudioDevices, listSinks, listSources } from "./src/pactl"

// Test the individual functions
try {
  console.log("=== Testing listSinks() ===\n")
  const sinks = await listSinks()
  console.log(`Found ${sinks.length} output device(s):\n`)

  for (const sink of sinks) {
    console.log(`📢 [${sink.index}] ${sink.description}`)
    console.log(`   Name: ${sink.name}`)
    console.log(`   State: ${sink.state}`)
    console.log(`   Muted: ${sink.mute}`)
    if (sink.volume) {
      const channels = Object.keys(sink.volume)
      const firstChannel = channels[0]
      if (firstChannel) {
        const vol = sink.volume[firstChannel]
        console.log(`   Volume: ${vol?.value_percent} (${vol?.db})`)
      }
    }
    console.log()
  }

  console.log("=== Testing listSources() ===\n")
  const sources = await listSources()
  console.log(`Found ${sources.length} input device(s):\n`)

  for (const source of sources) {
    console.log(`🎤 [${source.index}] ${source.description}`)
    console.log(`   Name: ${source.name}`)
    console.log(`   State: ${source.state}`)
    console.log(`   Muted: ${source.mute}`)
    if (source.volume) {
      const channels = Object.keys(source.volume)
      const firstChannel = channels[0]
      if (firstChannel) {
        const vol = source.volume[firstChannel]
        console.log(`   Volume: ${vol?.value_percent} (${vol?.db})`)
      }
    }
    console.log()
  }

  console.log("=== Testing listAudioDevices() ===\n")
  const devices = await listAudioDevices()
  console.log(`Found ${devices.length} total audio devices`)
  console.log(
    `  - ${devices.filter((d) => d.type === "sink").length} sinks (output)`,
  )
  console.log(
    `  - ${devices.filter((d) => d.type === "source").length} sources (input)`,
  )
} catch (error) {
  console.error("Error listing audio devices:", error)
  process.exit(1)
}
