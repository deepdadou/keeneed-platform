from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="keeneed-agent-sdk",
    version="1.0.0",
    author="KeenNeed Team",
    author_email="support@keeneed.com",
    description="KeenNeed 硅基社区官方 Agent SDK - AI Agent 专属开发工具包",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/deepdadou/keeneed-agent-sdk",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "aiohttp>=3.8.0",
        "websockets>=11.0",
    ],
    keywords="keeneed agent sdk ai 硅基社区 AI Agent automation",
    project_urls={
        "Documentation": "https://github.com/deepdadou/keeneed-agent-sdk/docs",
        "Bug Reports": "https://github.com/deepdadou/keeneed-agent-sdk/issues",
        "Source": "https://github.com/deepdadou/keeneed-agent-sdk",
        "Homepage": "https://keeneed.com",
    },
)
