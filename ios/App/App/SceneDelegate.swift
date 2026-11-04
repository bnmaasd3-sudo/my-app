import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var captureCover: UIView?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = CAPBridgeViewController()
        window.makeKeyAndVisible()
        self.window = window

        // Screen protection (see docs/ios.md). iOS has no FLAG_SECURE: the app's
        // content goes inside the layer iOS keeps out of screenshots for secure
        // text fields, and a cover hides it while the screen is recorded or mirrored.
        ScreenGuard.hideFromScreenshots(window)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(captureChanged),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )
        captureChanged()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// While the screen is recorded, mirrored or shared, the reader sees a plain cover instead of the book.
    @objc private func captureChanged() {
        guard let window = window else { return }
        let captured = window.windowScene?.screen.isCaptured ?? UIScreen.main.isCaptured
        if captured, captureCover == nil {
            let cover = ScreenGuard.cover(for: window.bounds)
            window.addSubview(cover)
            captureCover = cover
        } else if !captured {
            captureCover?.removeFromSuperview()
            captureCover = nil
        }
    }
}

enum ScreenGuard {
    /// Moves the window's layer inside a secure text field's container layer, which
    /// iOS leaves blank in screenshots and in the app switcher. If a future iOS
    /// changes that container, the app still works, only without this protection.
    static func hideFromScreenshots(_ window: UIWindow) {
        let field = UITextField()
        field.isSecureTextEntry = true
        field.isUserInteractionEnabled = false
        field.translatesAutoresizingMaskIntoConstraints = false
        window.addSubview(field)
        NSLayoutConstraint.activate([
            field.centerXAnchor.constraint(equalTo: window.centerXAnchor),
            field.centerYAnchor.constraint(equalTo: window.centerYAnchor),
        ])
        guard let container = field.layer.sublayers?.first else { return }
        window.layer.superlayer?.addSublayer(field.layer)
        container.addSublayer(window.layer)
    }

    /// A plain cover in the app's background colour.
    static func cover(for bounds: CGRect) -> UIView {
        let cover = UIView(frame: bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0x1a / 255, green: 0x17 / 255, blue: 0x14 / 255, alpha: 1)
                : UIColor(red: 0xfa / 255, green: 0xf7 / 255, blue: 0xf2 / 255, alpha: 1)
        }
        return cover
    }
}
