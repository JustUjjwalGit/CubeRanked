sed -i 's/updateProfile:/refreshProfile: () => Promise<void>;\n  updateProfile:/g' src/auth/AuthContext.tsx
sed -i '/const updateProfile = useCallback/i \  const refreshProfile = useCallback(async () => {\n    if (mode !== "authenticated") return;\n    try {\n      const profile = await fetchProfile();\n      setUser(profile);\n    } catch (e) {\n      console.error("Failed to refresh profile", e);\n    }\n  }, [mode]);\n' src/auth/AuthContext.tsx
sed -i 's/updateProfile,/refreshProfile,\n    updateProfile,/g' src/auth/AuthContext.tsx
