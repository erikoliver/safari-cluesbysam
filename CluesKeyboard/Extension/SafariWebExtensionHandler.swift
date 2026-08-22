// SPDX-License-Identifier: Apache-2.0

import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        // The content script provides all Version 1 functions.
        // Safari uses this native handler for extension lifecycle events.
        // A later version can also use this handler for messages.
        context.completeRequest(returningItems: nil)
    }
}
