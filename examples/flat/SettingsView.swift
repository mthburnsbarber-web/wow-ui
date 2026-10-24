import SwiftUI

struct SettingsView: View {
    @State private var tab = 0
    @State private var loading = true

    var body: some View {
        VStack {
            Picker("Tab", selection: $tab) {
                Text("General").tag(0)
                Text("Privacy").tag(1)
            }
            .pickerStyle(.segmented)

            if loading { ProgressView() }

            Button("Upgrade") {}
                .foregroundColor(.yellow)
        }
        .transition(.opacity)
        .animation(.linear(duration: 0.3), value: tab)
    }
}
