import importlib.util
import json
from pathlib import Path
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('privacy', Path(__file__).with_name('verify-ios-privacy.py'))
privacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(privacy)


class PackagedPrivacyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / 'Fixture.app'
        self.resource = self.app / 'SDK.bundle/PrivacyInfo.xcprivacy'
        self.resource.parent.mkdir(parents=True)
        self.manifest = {'NSPrivacyTracking': False, 'NSPrivacyTrackingDomains': []}
        self.resource.write_bytes(plistlib.dumps(self.manifest))
        self.lock = self.root / 'lock.json'
        self.lock.write_text(json.dumps({'pins': [{'identity': 'sdk', 'state': {'revision': 'pinned'}}]}))
        self.baseline = self.root / 'baseline.json'
        self.baseline.write_text(json.dumps({'schemaVersion': 1, 'packages': [{'identity': 'sdk', 'revision': 'pinned'}],
            'manifests': {'SDK.bundle/PrivacyInfo.xcprivacy': privacy.digest(self.manifest)}}))

    def verify(self):
        return privacy.verify(self.app, self.baseline, self.lock)

    def test_xml_and_binary_plists_keep_same_declarations(self):
        first = self.verify()
        self.resource.write_bytes(plistlib.dumps(self.manifest, fmt=plistlib.FMT_BINARY))
        self.assertEqual(first, self.verify())
        self.assertEqual(first['manifestCount'], 1)

    def test_missing_manifest_fails(self):
        self.resource.unlink()
        with self.assertRaisesRegex(ValueError, 'missing='):
            self.verify()

    def test_new_root_manifest_requires_review(self):
        (self.app / 'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'added='):
            self.verify()

    def test_changed_tracking_declaration_fails(self):
        self.resource.write_bytes(plistlib.dumps({**self.manifest, 'NSPrivacyTracking': True}))
        with self.assertRaisesRegex(ValueError, 'declaration changed'):
            self.verify()

    def test_changed_sdk_revision_fails(self):
        self.lock.write_text(json.dumps({'pins': [{'identity': 'sdk', 'state': {'revision': 'new'}}]}))
        with self.assertRaisesRegex(ValueError, 'SDK lock changed'):
            self.verify()

    def test_malformed_manifest_fails(self):
        self.resource.write_bytes(b'not a plist')
        with self.assertRaises(plistlib.InvalidFileException):
            self.verify()

    def test_external_symlink_fails(self):
        external = self.root / 'external.plist'
        self.resource.rename(external)
        self.resource.symlink_to(external)
        with self.assertRaisesRegex(ValueError, 'contained regular resource'):
            self.verify()


if __name__ == '__main__':
    unittest.main()
