// SPDX-License-Identifier: Apache-2.0

import SafariServices
import SwiftUI

@main
struct CluesKeyboardApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 480, minHeight: 420)
        }
        .windowResizability(.contentSize)
    }
}

private struct ShortcutRow: View {
    let keys: String
    let action: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(keys)
                .font(.system(.body, design: .monospaced, weight: .semibold))
                .frame(width: 130, alignment: .trailing)
            Text(action)
            Spacer()
        }
    }
}

struct ContentView: View {
    private let extensionIdentifier = "net.valdemar.safari-cluesbysam.Extension"

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Clues by Sam Keyboard")
                .font(.largeTitle.bold())
            Text("Enable the extension in Safari. Allow access to cluesbysam.com. Then open a puzzle. Press ? to open the keyboard shortcut list.")
                .fixedSize(horizontal: false, vertical: true)

            Group {
                ShortcutRow(keys: "Arrow keys", action: "Move through the grid. Movement wraps at each edge.")
                ShortcutRow(keys: "Space / Return", action: "Activate the current card")
                ShortcutRow(keys: "I / C", action: "Choose Innocent or Criminal")
                ShortcutRow(keys: "0–6", action: "Set the top corner tag")
                ShortcutRow(keys: "Shift + 0–6", action: "Set the bottom corner tag")
                ShortcutRow(keys: "?", action: "Open the keyboard shortcut list")
                ShortcutRow(keys: "Escape", action: "Close the current dialog")
            }

            Spacer()
            Button("Open Safari Extension Settings") {
                SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionIdentifier) { _ in }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(28)
    }
}
