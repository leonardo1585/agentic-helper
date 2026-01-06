#!/usr/bin/env python3
"""
Setup para criar o aplicativo Mac (.app) do GTH.
Usa py2app para criar o bundle.
"""
from setuptools import setup

APP = ['gth_app.py']
DATA_FILES = []
OPTIONS = {
    'argv_emulation': True,
    'iconfile': 'icons/icon.icns',
    'plist': {
        'CFBundleName': 'GTH',
        'CFBundleDisplayName': 'GTH - Git Helper Tool',
        'CFBundleGetInfoString': 'Ferramenta para análise de repositórios com IA',
        'CFBundleIdentifier': 'com.gth.app',
        'CFBundleVersion': '1.0.0',
        'CFBundleShortVersionString': '1.0.0',
        'NSHumanReadableCopyright': '© 2024 GTH',
        'NSHighResolutionCapable': True,
    },
    'packages': ['webview'],
    'includes': ['webview'],
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)

