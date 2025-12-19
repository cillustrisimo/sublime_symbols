def prepareInteractiveVisualizationWithAllImages(
    results_dict,
    audio_dir='audio_extracted',
    output_dir='interactive_viz',
    cluster_keywords=None,
    cluster_comments=None,
    cluster_genres=None,
    max_clusters=30,
    n_range_images=1,
    composite_image_path=None
):
    """
    prepare all data and assets for the interactive visualization, including all images per cluster.
    """
    import numpy as np
    import os
    import json
    import shutil
    import re
    import tqdm
    from pathlib import Path
    from collections import defaultdict
    from PIL import Image
    from sklearn.metrics.pairwise import euclidean_distances
    
    def convertToNative(obj):
        """
        recursively convert numpy types to native python types.
        """
        if isinstance(obj, dict):
            return {convertToNative(k): convertToNative(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convertToNative(item) for item in obj]
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return obj
    
    def extractVideoNameFromFrame(frame_name):
        """
        extract video name from frame filename pattern.
        """
        pattern = r'^(.+)_cluster\d+_frame\d+$'
        match = re.match(pattern, frame_name)
        return match.group(1) if match else frame_name
    
    def findAudioForVideo(video_name, audio_dir):
        """
        find audio file matching a video name.
        """
        audio_dir = Path(audio_dir)
        extensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm']
        for ext in extensions:
            audio_path = audio_dir / f"{video_name}{ext}"
            if audio_path.exists():
                return audio_path
            audio_path = audio_dir / f"AUDIO_{video_name}{ext}"
            if audio_path.exists():
                return audio_path
        for ext in extensions:
            matches = list(audio_dir.glob(f"*{video_name}*{ext}"))
            if matches:
                return matches[0]
        return None
    
    # extract from results
    embeddings = results_dict['embeddings']
    umap_embeddings = results_dict['umap_embeddings']
    labels = results_dict['labels']
    metadata = results_dict['metadata']
    cluster_representatives = results_dict['cluster_representatives']
    
    cluster_keywords = cluster_keywords or results_dict.get('cluster_keywords', {})
    cluster_comments = cluster_comments or results_dict.get('cluster_comments', {})
    cluster_genres = cluster_genres or results_dict.get('cluster_genres', {})
    
    # setup output directories
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / 'audio').mkdir(exist_ok=True)
    (output_dir / 'images').mkdir(exist_ok=True)
    (output_dir / 'composites').mkdir(exist_ok=True)
    (output_dir / 'all_images').mkdir(exist_ok=True)
    
    # build cluster to video mapping
    cluster_videos = defaultdict(set)
    video_to_frames = defaultdict(list)
    
    for idx, label in enumerate(labels):
        if label == -1:
            continue
        frame_name = metadata[idx]['frame_name']
        video_name = extractVideoNameFromFrame(frame_name)
        cluster_videos[int(label)].add(video_name)
        video_to_frames[video_name].append(idx)
    
    # select largest clusters
    unique_clusters = sorted([int(l) for l in set(labels) if l != -1])
    cluster_sizes = {cid: int(np.sum(labels == cid)) for cid in unique_clusters}
    selected_clusters = sorted(cluster_sizes.items(), key=lambda x: x[1], reverse=True)[:max_clusters]
    selected_cluster_ids = [int(cid) for cid, _ in selected_clusters]
    
    print(f"processing {len(selected_cluster_ids)} clusters...")
    
    clusters_data = {}
    
    for cluster_id in tqdm.tqdm(selected_cluster_ids, desc="processing clusters"):
        
        # compute cluster embeddings and distances to centroid
        cluster_mask = labels == cluster_id
        cluster_indices = np.where(cluster_mask)[0]
        cluster_embeddings = umap_embeddings[cluster_indices]
        centroid = cluster_embeddings.mean(axis=0).reshape(1, -1)
        distances = euclidean_distances(cluster_embeddings, centroid).flatten()
        
        # find representative audio from video closest to centroid
        videos_in_cluster = cluster_videos.get(cluster_id, set())
        best_video = None
        best_distance = float('inf')
        
        for video_name in videos_in_cluster:
            video_frame_indices = [idx for idx in video_to_frames[video_name] 
                                   if labels[idx] == cluster_id]
            if video_frame_indices:
                video_embeddings = umap_embeddings[video_frame_indices]
                avg_dist = float(np.mean(euclidean_distances(video_embeddings, centroid)))
                if avg_dist < best_distance:
                    best_distance = avg_dist
                    best_video = video_name
        
        # copy audio file if found
        audio_filename = None
        if best_video:
            audio_path = findAudioForVideo(best_video, audio_dir)
            if audio_path and audio_path.exists():
                audio_filename = f"cluster_{cluster_id}{audio_path.suffix}"
                shutil.copy(audio_path, output_dir / 'audio' / audio_filename)
        
        # get range images at quantile positions
        quantiles = {'min': 0, 'q25': 25, 'median': 50, 'q75': 75, 'max': 100}
        quantile_values = {name: np.percentile(distances, pct) for name, pct in quantiles.items()}
        
        range_images = {}
        for quantile_name, target_distance in quantile_values.items():
            distance_diffs = np.abs(distances - target_distance)
            closest_indices = np.argsort(distance_diffs)[:n_range_images]
            
            range_images[quantile_name] = []
            for idx in closest_indices:
                global_idx = cluster_indices[idx]
                thumb_filename = f"cluster_{cluster_id}_{quantile_name}_{len(range_images[quantile_name])}.jpg"
                
                try:
                    img = Image.open(metadata[global_idx]['image_path']).convert('RGB')
                    img.thumbnail((200, 200), Image.Resampling.LANCZOS)
                    img.save(output_dir / 'images' / thumb_filename, 'JPEG', quality=85)
                    
                    range_images[quantile_name].append({
                        'filename': thumb_filename,
                        'distance': float(distances[idx])
                    })
                except Exception as e:
                    pass
        
        # collect all images sorted by distance to centroid
        all_images = []
        sorted_local_indices = np.argsort(distances)
        
        for i, local_idx in enumerate(sorted_local_indices):
            global_idx = cluster_indices[local_idx]
            img_path = metadata[global_idx]['image_path']
            distance = distances[local_idx]
            
            filename = f"cluster_{cluster_id}_img_{i:04d}.jpg"
            try:
                img = Image.open(img_path).convert('RGB')
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                img.save(output_dir / 'all_images' / filename, 'JPEG', quality=85)
                all_images.append({
                    'filename': filename,
                    'distance': float(distance),
                    'original_path': os.path.basename(img_path)
                })
            except Exception as e:
                pass
        
        # create cluster composite from representatives
        rep_indices = cluster_representatives.get(cluster_id, [])[:9]
        composite_filename = None
        if rep_indices:
            composite = Image.new('RGB', (300, 300), 'white')
            for i, idx in enumerate(rep_indices[:9]):
                row, col = i // 3, i % 3
                try:
                    img = Image.open(metadata[idx]['image_path']).convert('RGB')
                    img = img.resize((100, 100), Image.Resampling.LANCZOS)
                    composite.paste(img, (col * 100, row * 100))
                except:
                    pass
            composite_filename = f"composite_{cluster_id}.jpg"
            composite.save(output_dir / 'composites' / composite_filename, 'JPEG', quality=90)
        
        # build cluster data entry
        clusters_data[str(cluster_id)] = {
            'id': int(cluster_id),
            'size': int(cluster_sizes[cluster_id]),
            'stats': {
                'size': int(len(cluster_indices)),
                'mean_distance': float(np.mean(distances)),
                'std_distance': float(np.std(distances)),
                'min_distance': float(np.min(distances)),
                'max_distance': float(np.max(distances))
            },
            'keywords': cluster_keywords.get(cluster_id, []),
            'comments': cluster_comments.get(cluster_id, 'No comments'),
            'genre': cluster_genres.get(cluster_id, 'Unknown'),
            'audio': audio_filename,
            'audio_video': best_video,
            'composite': composite_filename,
            'range_images': range_images,
            'all_images': all_images
        }
    
    # copy main visualization if provided
    if composite_image_path and Path(composite_image_path).exists():
        shutil.copy(composite_image_path, output_dir / 'main_visualization.png')
    
    # save json data
    output_data = {
        'clusters': clusters_data,
        'cluster_order': [int(x) for x in selected_cluster_ids],
        'total_frames': int(len(metadata)),
        'total_clusters': int(len(unique_clusters))
    }
    
    output_data = convertToNative(output_data)
    
    with open(output_dir / 'cluster_data.json', 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"data prepared in: {output_dir}")
    
    return output_dir