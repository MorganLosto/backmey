
import sys
import shutil
import logging
# Add current dir to path to import backmey
sys.path.append(".")
from backmey import SmartPackageResolver, info, warn

# Setup basic logging to stdout
logging.basicConfig(level=logging.INFO)

def test_resolver():
    manager = None
    for m in ["apt", "dnf", "pacman", "zypper"]:
        if shutil.which(m):
            manager = m
            break
    
    if not manager:
        print("Skipping test: No supported package manager found.")
        return

    print(f"Testing Smart Resolver with manager: {manager}")
    resolver = SmartPackageResolver(manager, verbose=True)

    # Test Case 1: Package that typically needs suffix
    # 'google-chrome' is often 'google-chrome-stable'
    pkg = "google-chrome"
    print(f"\n[Test] Resolving '{pkg}'...")
    result = resolver.resolve(pkg)
    print(f"Result: {result}")

    # Test Case 2: python3 package
    # 'requests' -> 'python3-requests' (on debian)
    pkg = "requests"
    print(f"\n[Test] Resolving '{pkg}'...")
    result = resolver.resolve(pkg)
    print(f"Result: {result}")

if __name__ == "__main__":
    test_resolver()
