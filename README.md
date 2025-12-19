# Sublime Symbols: White Thymos in Alt-Right Corecore Edits

An ongoing research project that uses computational methods to inductively identify and catalog recurrent visual symbols in alt-right TikTok "corecore" edits.

**Explore the initial data at:** [cillustrisimo.github.io/sublime_symbols]

---

## Content Warning

**This research analyzes alt-right propaganda.** Due to the nature of the source material, images, audio, and text displayed may include racist, sexist, antisemitic, and otherwise hateful or disturbing content. This project documents these materials for academic research purposes only. Viewer discretion is strongly advised.

**Note:** This is a work in progress. Current results may contain noise, errors, or sensitive information.

---

## Research Overview

### Motivation

Literary and media scholars have framed "corecore"—a TikTok genre of hyperaestheticized video montages—as a reconstitution of the doomscroll: algorithmic logic evoking catharsis through distilled informational excess. However, this analysis falls short when considering the political mobilization of corecore by alt-right communities.

This project argues that corecore edits are assembled, that the selection of imagery in TikToks are a careful, curated choice. By focusing on what Bharath Ganesh calls **"white thymos"**—symbols that beget white supremacist affects—this research seeks to surface the visual signs that distinguish alt-right corecore from mainstream instantiations of the genre.

### Central Research Question

> Can we computationally surface symbols of white thymos in corecore and use them to distinguish between normative and alt-right instantiations of the genre?

---

## Data

- **~1,492 TikTok videos** total
  - **~910 videos** from alt-right-associated hashtags: `#hyperborea`, `#agartha`, `#vril`, `#anotherXclassic`
  - **~600 videos** from mainstream tags: `#nichetok`, `#corecore`, `#hopecore`
- **~25,000 comments** (~10-20 per video)
- **Current analysis:** Initial clustering performed on ~900 alt-right videos, yielding 4,710 frames and 10,909 comments

### Alt-Right Hashtag Glossary

| Tag | Description |
|-----|-------------|
| `hyperborea` | Conspiracy theory of a hidden land beyond polar ice on a flat earth |
| `agartha` | Atlantis-esque mythical land associated with "Aryan" peoples |
| `vril` | Reference to 19th-century white supremacist fiction |
| `another X classic` | Common alt-right phrase where X = "aryan," "european," etc. |

---

## Methodology

The pipeline is inspired by the **Peircean triadic model of semiotics**, which understands signs through three components:
- **Sign** — the thing that stands for something else (cluster label)
- **Object** — what the sign represents (image captions)
- **Interpretant** — the meaning/effect produced (audience comments)

### Pipeline Overview

1. **Video Data Extraction**
   - Extract frames (1 fps) using OpenCV2
   - Reduce to 128×128, apply PCA + minibatch k-means to select representative frames
   - Generate dense captions using Florence-2

2. **Audio/Label Extraction**
   - Extract audio from videos using ffmpeg
   - Pull music descriptors from Google's MusicCaps dataset (genre, mood, instruments, tempo, vocals)
   - Generate captions via CLAP (Contrastive Language-Audio Pretraining) similarity matching
   - Derive cluster-distinctive terms using c-TF-IDF and log-odds ratios

3. **Clustering Pipeline**
   - Create multimodal embeddings via CLIP (image + caption, element-wise addition to enhance embeddings)
   - Dimensionality reduction with UMAP
   - Clustering with HDBSCAN
   - Representative frame selection using greedy submodular optimization
   - Derive descriptors via TF-IDF (captions) and log-odds (comments)

---

## Current Limitations

- Pipeline captures large visual similarities but may miss fine-grained embedded symbols (e.g., swastikas made to look like a sun in the background)
- Florence-2 captioning may be limited by RLHF safety measures; considering "jailbroken" alternatives

=