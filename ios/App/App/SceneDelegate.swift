import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var captureCover: UIView?
    private var backgroundCover: UIView?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Info.plist names Main.storyboard for the scene, so UIKit may already have
        // made the window and its Capacitor bridge; make one only if it has not,
        // so there is never a second bridge.
        if window == nil {
            let window = UIWindow(windowScene: windowScene)
            window.rootViewController = CAPBridgeViewController()
            self.window = window
        }
        guard let window = window else { return }
        window.makeKeyAndVisible()

        // Screen protection (see docs/ios.md). iOS has no FLAG_SECURE: the app's
        // content goes inside the layer iOS keeps out of screenshots for secure
        // text fields, and a cover hides it while the screen is recorded or mirrored.
        if let content = window.rootViewController?.view {
            DispatchQueue.main.async { ScreenGuard.hideFromScreenshots(content) }
        }
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(captureChanged),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )
        captureChanged()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    /// Leaving the app (home, app switcher) covers the book, so its last screen is
    /// not kept as the app's picture. A short loss of focus (Notification Center,
    /// a call banner) does not: the owner found dimming while reading distracting.
    func sceneDidEnterBackground(_ scene: UIScene) {
        guard let window = window, backgroundCover == nil else { return }
        let cover = ScreenGuard.cover(for: window.bounds)
        window.addSubview(cover)
        backgroundCover = cover
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        backgroundCover?.removeFromSuperview()
        backgroundCover = nil
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
    /// Moves the content view's layer inside a secure text field's container layer,
    /// which iOS leaves blank in screenshots and in the app switcher. The view stays
    /// where it is in the view hierarchy, so touches and layout are unchanged; only
    /// its layer is drawn through the secure container. If the container is not
    /// there (a future iOS may change it), nothing is moved and the app runs as is.
    static func hideFromScreenshots(_ content: UIView) {
        guard let host = content.layer.superlayer else { return }
        let field = UITextField()
        field.isSecureTextEntry = true
        field.isUserInteractionEnabled = false
        field.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(field)
        NSLayoutConstraint.activate([
            field.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            field.centerYAnchor.constraint(equalTo: content.centerYAnchor),
        ])
        field.layoutIfNeeded()
        guard let container = field.layer.sublayers?.first else {
            field.removeFromSuperview()
            return
        }
        // The field's layer goes up beside the content, then the content goes into
        // the field's secure container: no layer ends up inside itself.
        host.addSublayer(field.layer)
        container.addSublayer(content.layer)
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
