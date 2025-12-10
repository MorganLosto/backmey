import os
import tempfile
from argparse import Namespace
from pathlib import Path
import unittest
from unittest import mock

from backmey import DesktopDetector, PackageInstaller, backup, restore


class BackmeyTests(unittest.TestCase):
    def setUp(self) -> None:
        self._home_backup = os.environ.get("BACKMEY_HOME")

    def tearDown(self) -> None:
        if self._home_backup is None:
            os.environ.pop("BACKMEY_HOME", None)
        else:
            os.environ["BACKMEY_HOME"] = self._home_backup

    def test_backup_and_restore_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as src_home, tempfile.TemporaryDirectory() as dest_home, tempfile.TemporaryDirectory() as artifacts:
            os.environ["BACKMEY_HOME"] = src_home
            src_home_path = Path(src_home)
            (src_home_path / ".config/app").mkdir(parents=True)
            (src_home_path / ".config/app/config.ini").write_text("value=1")
            (src_home_path / ".themes/cool").mkdir(parents=True)
            (src_home_path / ".themes/cool/theme.txt").write_text("theme-data")
            (src_home_path / "Pictures/Wallpapers").mkdir(parents=True)
            (src_home_path / "Pictures/Wallpapers/wall.jpg").write_text("wallpaper")

            archive = Path(artifacts) / "backup.tar.gz"
            backup(
                Namespace(
                    output=str(archive),
                    store_dir=None,
                    profile=None,
                    version=None,
                    sync_command=None,
                    components=None,
                    with_browser_profiles=False,
                    no_packages=True,
                    report_sizes=False,
                    dry_run=False,
                    notes=None,
                    verbose=False,
                )
            )
            self.assertTrue(archive.exists())

            os.environ["ULDBR_HOME"] = dest_home
            restore(
                Namespace(
                    archive=str(archive),
                    profile=None,
                    version=None,
                    store_dir=None,
                    template=None,
                    template_dir=None,
                    components=None,
                    yes=True,
                    skip_conflicts=False,
                    dry_run=False,
                    no_snapshot=True,
                    snapshot_dir=None,
                    install_packages=False,
                    install_managers=None,
                    install_dry_run=False,
                    verbose=False,
                )
            )

            dest_home_path = Path(dest_home)
            self.assertEqual(
                (dest_home_path / ".config/app/config.ini").read_text(), "value=1"
            )
            self.assertEqual(
                (dest_home_path / ".themes/cool/theme.txt").read_text(), "theme-data"
            )
            self.assertEqual(
                (dest_home_path / "Pictures/Wallpapers/wall.jpg").read_text(), "wallpaper"
            )

    def test_restore_dry_run_no_changes(self) -> None:
        with tempfile.TemporaryDirectory() as src_home, tempfile.TemporaryDirectory() as dest_home, tempfile.TemporaryDirectory() as artifacts:
            os.environ["ULDBR_HOME"] = src_home
            src_home_path = Path(src_home)
            (src_home_path / ".config/app").mkdir(parents=True)
            (src_home_path / ".config/app/config.ini").write_text("value=1")

            archive = Path(artifacts) / "backup.tar.gz"
            backup(
                Namespace(
                    output=str(archive),
                    store_dir=None,
                    profile=None,
                    version=None,
                    sync_command=None,
                    components=None,
                    with_browser_profiles=False,
                    no_packages=True,
                    report_sizes=False,
                    dry_run=False,
                    notes=None,
                    verbose=False,
                )
            )

            os.environ["ULDBR_HOME"] = dest_home
            dest_home_path = Path(dest_home)
            (dest_home_path / ".config/app").mkdir(parents=True)
            (dest_home_path / ".config/app/config.ini").write_text("original")

            restore(
                Namespace(
                    archive=str(archive),
                    profile=None,
                    version=None,
                    store_dir=None,
                    template=None,
                    template_dir=None,
                    components=None,
                    yes=True,
                    skip_conflicts=False,
                    dry_run=True,
                    no_snapshot=True,
                    snapshot_dir=None,
                    install_packages=False,
                    install_managers=None,
                    install_dry_run=False,
                    verbose=False,
                )
            )

            self.assertEqual(
                (dest_home_path / ".config/app/config.ini").read_text(), "original"
            )
            self.assertFalse((dest_home_path / ".themes").exists())

    def test_desktop_detector_prefers_env(self) -> None:
        detector = DesktopDetector(verbose=False)
        with mock.patch.object(detector, "_scan_processes", return_value=[]), mock.patch.dict(
            os.environ,
            {
                "XDG_CURRENT_DESKTOP": "GNOME:KDE",
                "DESKTOP_SESSION": "plasma",
                "GDMSESSION": "plasma",
            },
            clear=False,
        ):
            detection = detector.detect()
        self.assertEqual(detection["desktop"], "GNOME")

    def test_package_installer_plan_order(self) -> None:
        installer = PackageInstaller(verbose=False, assume_yes=False)
        installer.available = {"pacman", "flatpak"}
        installer.distro_order = lambda: ["flatpak", "pacman"]
        manifest_packages = {"flatpak": ["org.mozilla.firefox"], "pacman": ["firefox"]}
        canonical = ["firefox", "alacritty"]

        plan = installer.build_plan(manifest_packages, canonical)
        self.assertEqual(plan[0].manager, "flatpak")
        self.assertIn("flatpak", plan[0].command[0])
        self.assertEqual(plan[1].manager, "pacman")
        self.assertIn("sudo", plan[1].command[0])

    def test_package_substitution_applied(self) -> None:
        installer = PackageInstaller(verbose=False, assume_yes=False)
        installer.available = {"apt"}
        installer.os_release = {"id": "debian", "id_like": "debian"}
        installer.distro_subs = {"debian": {"firefox": "firefox-esr"}}
        plan = installer.build_plan(manifest_packages={}, canonical_packages=["firefox"])
        self.assertEqual(plan[0].packages[0], "firefox-esr")

    def test_backup_dry_run_preview(self) -> None:
        with tempfile.TemporaryDirectory() as src_home, tempfile.TemporaryDirectory() as artifacts:
            os.environ["ULDBR_HOME"] = src_home
            src_home_path = Path(src_home)
            (src_home_path / ".config/app").mkdir(parents=True)
            (src_home_path / ".config/app/config.ini").write_text("value=1")
            archive = Path(artifacts) / "backup.tar.gz"
            backup(
                Namespace(
                    output=str(archive),
                    store_dir=None,
                    profile=None,
                    version=None,
                    sync_command=None,
                    components=None,
                    with_browser_profiles=False,
                    no_packages=True,
                    report_sizes=False,
                    dry_run=True,
                    notes=None,
                    verbose=False,
                )
            )
            self.assertFalse(archive.exists())


if __name__ == "__main__":
    unittest.main()
